from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import requests
import datetime
import asyncio
import os
import base64
import binascii
import hashlib
import hmac
from typing import Any, Dict, List, Optional
from supabase import create_client, Client
from pydantic import BaseModel


def load_dotenv(dotenv_path: str = ".env") -> None:
    """Carrega variaveis de um .env sem sobrescrever as ja definidas no ambiente."""
    if not os.path.exists(dotenv_path):
        return

    with open(dotenv_path, "r", encoding="utf-8") as env_file:
        for raw_line in env_file:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


def get_required_env(name: str) -> str:
    value = (os.getenv(name) or "").strip()
    if not value:
        raise RuntimeError(f"Variavel de ambiente obrigatoria ausente: {name}")
    return value


def parse_allowed_origins(raw: str) -> List[str]:
    origins = [origin.strip() for origin in raw.split(",") if origin.strip()]
    return origins or ["http://localhost:5173"]


def hash_password(plain_password: str, iterations: int = 310000) -> str:
    salt = os.urandom(16)
    password_hash = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt, iterations)
    salt_b64 = base64.b64encode(salt).decode("ascii")
    hash_b64 = base64.b64encode(password_hash).decode("ascii")
    return f"pbkdf2_sha256${iterations}${salt_b64}${hash_b64}"


def verify_password(plain_password: str, stored_password: str) -> bool:
    if not stored_password or not stored_password.startswith("pbkdf2_sha256$"):
        return False

    try:
        _, iterations, salt_b64, hash_b64 = stored_password.split("$", 3)
        salt = base64.b64decode(salt_b64.encode("ascii"))
        expected_hash = base64.b64decode(hash_b64.encode("ascii"))
        calculated_hash = hashlib.pbkdf2_hmac(
            "sha256",
            plain_password.encode("utf-8"),
            salt,
            int(iterations),
        )
        return hmac.compare_digest(calculated_hash, expected_hash)
    except (ValueError, binascii.Error):
        return False


def evaluate_password_strength(password: str) -> Dict[str, Any]:
    normalized_password = (password or "").strip()
    checks = [
        len(normalized_password) >= 8,
        len(normalized_password) >= 12,
        any(char.islower() for char in normalized_password) and any(char.isupper() for char in normalized_password),
        any(char.isdigit() for char in normalized_password),
        any(not char.isalnum() for char in normalized_password),
    ]
    score = sum(1 for passed in checks if passed)

    if score <= 2:
        return {"level": "weak", "label": "Muito fraca", "is_acceptable": False}
    if score == 3:
        return {"level": "medium", "label": "Média", "is_acceptable": True}
    if score == 4:
        return {"level": "strong", "label": "Forte", "is_acceptable": True}
    return {"level": "verystrong", "label": "Muito forte", "is_acceptable": True}


def verify_admin_credentials(username: str, password: str) -> Optional[Dict[str, Any]]:
    """
    Verifica credenciais do admin consultando a tabela administradores no Supabase.
    Retorna os dados do admin se válido, None caso contrário.
    """
    normalized_username = (username or "").strip()
    normalized_password = (password or "").strip()

    if not normalized_username or not normalized_password:
        return None

    try:
        res = supabase.table("administradores").select("*").eq("username", normalized_username).execute()
        if not res.data:
            return None

        admin = res.data[0]
        
        # Verifica se está ativo
        if not admin.get("ativo", True):
            return None

        # Verifica a senha (sempre armazenada em hash no banco)
        if verify_password(normalized_password, str(admin.get("senha") or "")):
            return admin
        
        return None
    except Exception as e:
        print(f"Erro ao verificar credenciais do admin: {e}")
        return None


def create_manager_token(username: str) -> str:
    issued_at = str(int(datetime.datetime.now(datetime.timezone.utc).timestamp()))
    nonce = os.urandom(8).hex()
    payload = f"{username}:{issued_at}:{nonce}"
    signature = hmac.new(ADMIN_AUTH_SECRET.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    raw_token = f"{payload}:{signature}"
    return base64.urlsafe_b64encode(raw_token.encode("utf-8")).decode("ascii").rstrip("=")


def verify_manager_token(token: str) -> bool:
    """
    Valida token do gerenciador.
    Verifica assinatura, expiração e validade.
    """
    normalized_token = (token or "").strip()
    if not normalized_token:
        return False

    padding = "=" * (-len(normalized_token) % 4)
    try:
        decoded = base64.urlsafe_b64decode(f"{normalized_token}{padding}".encode("ascii")).decode("utf-8")
        username, issued_at, nonce, signature = decoded.split(":", 3)
    except (ValueError, binascii.Error, UnicodeDecodeError):
        return False

    payload = f"{username}:{issued_at}:{nonce}"
    expected_signature = hmac.new(ADMIN_AUTH_SECRET.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected_signature):
        return False

    # Verifica se o admin ainda existe e está ativo
    try:
        res = supabase.table("administradores").select("ativo").eq("username", username).execute()
        if not res.data or not res.data[0].get("ativo", True):
            return False
    except Exception:
        return False

    try:
        issued_at_ts = int(issued_at)
    except ValueError:
        return False

    now_ts = int(datetime.datetime.now(datetime.timezone.utc).timestamp())
    if now_ts - issued_at_ts > MANAGER_TOKEN_TTL_SECONDS:
        return False

    return True


def require_manager_auth(authorization: Optional[str]) -> None:
    if not authorization:
        raise HTTPException(status_code=401, detail="Acesso restrito. Faça login no painel admin.")

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not verify_manager_token(token):
        raise HTTPException(status_code=401, detail="Sessão do admin inválida ou expirada.")


def validate_analyst_password(analyst_id: int, received_password: str, stored_password: str) -> bool:
    normalized_received_password = (received_password or "").strip()
    normalized_stored_password = (stored_password or "").strip()

    password_is_valid = verify_password(normalized_received_password, normalized_stored_password)
    if not password_is_valid and normalized_received_password == normalized_stored_password:
        new_password_hash = hash_password(normalized_received_password)
        supabase.table("analistas").update({"senha": new_password_hash}).eq("id", analyst_id).execute()
        password_is_valid = True

    return password_is_valid


def is_missing_transfer_logs_table_error(error_message: str) -> bool:
    return (
        "logs_transferencias" in error_message
        and (
            "does not exist" in error_message
            or "42P01" in error_message
            or "PGRST205" in error_message
            or "schema cache" in error_message
        )
    )


def build_transfer_log_payload(
    *,
    reserva_id: Any,
    origem: Dict[str, Any],
    destino: Dict[str, Any],
    pasta: Dict[str, Any],
    situacao_id: int,
    motivo: str,
    data_transferencia: str,
) -> Dict[str, Any]:
    return {
        "reserva_id": str(reserva_id),
        "analista_origem_id": int(origem.get("id")),
        "analista_origem_nome": origem.get("nome"),
        "analista_destino_id": int(destino.get("id")),
        "analista_destino_nome": destino.get("nome"),
        "situacao_id": situacao_id,
        "situacao_nome": pasta.get("situacao_nome") or SITUACOES_NOMES.get(situacao_id, "Geral"),
        "cliente": pasta.get("cliente"),
        "empreendimento": pasta.get("empreendimento"),
        "unidade": pasta.get("unidade"),
        "motivo": motivo,
        "data_transferencia": data_transferencia,
    }


load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

ALLOWED_ORIGINS = parse_allowed_origins(os.getenv("ALLOWED_ORIGINS", "http://localhost:5173"))
SYNC_INTERVAL_SECONDS = int(os.getenv("SYNC_INTERVAL_SECONDS", "25"))
PORT = int(os.getenv("PORT", "8000"))

SUPABASE_URL = get_required_env("SUPABASE_URL")
SUPABASE_KEY = get_required_env("SUPABASE_KEY")
CVCRM_EMAIL = get_required_env("CVCRM_EMAIL")
CVCRM_TOKEN = get_required_env("CVCRM_TOKEN")
ADMIN_AUTH_SECRET = (os.getenv("ADMIN_AUTH_SECRET") or SUPABASE_KEY).strip()
MANAGER_TOKEN_TTL_SECONDS = int(os.getenv("MANAGER_TOKEN_TTL_SECONDS", "43200"))

app = FastAPI(title="VCA Distribuidor - Backend Oficial")

# Configuração de CORS para o Frontend
if isinstance(ALLOWED_ORIGINS, list):
    cors_origins = ALLOWED_ORIGINS.copy()
else:
    cors_origins = parse_allowed_origins(str(ALLOWED_ORIGINS))

# Adicionar URL de produção (Vercel) se não estiver já configurada
if "https://distribuidor-analises.vercel.app" not in cors_origins:
    cors_origins.append("https://distribuidor-analises.vercel.app")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- CONFIGURAÇÃO SUPABASE ---
try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("[OK] Conex\u00e3o com Supabase estabelecida.")
except Exception as e:
    print(f"[ERRO] Erro ao ligar ao Supabase: {e}")

# --- MAPEAMENTO DE SITUAÇÕES DO CVCRM ---
SITUACOES_NOMES = {
    62: "ANÁLISE VENDA LOTEAMENTO",
    66: "ANÁLISE VENDA PARCELAMENTO INCORPORADORA",
    30: "ANÁLISE VENDA CAIXA",
    16: "CONFECÇÃO DE CONTRATO",
    31: "ASSINADO",
    84: "APROVAÇÃO EXPANSÃO"
}
SITUACOES_IDS = list(SITUACOES_NOMES.keys())

HEADERS = {
    "email": CVCRM_EMAIL,
    "token": CVCRM_TOKEN,
    "accept": "application/json"
}


async def fetch_cvcrm_reservas(sit_id: int, timeout_seconds: int):
    """Executa request ao CRM fora do event loop para evitar bloqueio."""
    url = f"https://vca.cvcrm.com.br/api/v1/comercial/reservas?situacao={sit_id}"
    return await asyncio.to_thread(requests.get, url, headers=HEADERS, timeout=timeout_seconds)


def parse_history_datetime(value: Optional[str]) -> Optional[datetime.datetime]:
    normalized_value = (value or "").strip()
    if not normalized_value:
        return None

    try:
        return datetime.datetime.fromisoformat(normalized_value.replace("Z", "+00:00"))
    except ValueError:
        return None


def build_sorted_counter(counter_map: Dict[str, int], *, limit: Optional[int] = None) -> List[Dict[str, Any]]:
    items = [
        {"label": label, "total": total}
        for label, total in counter_map.items()
    ]
    items.sort(key=lambda item: (-item["total"], item["label"]))
    if limit is not None:
        return items[:limit]
    return items


def build_daily_series(counter_map: Dict[str, int], *, limit: int = 14) -> List[Dict[str, Any]]:
    ordered_keys = sorted(counter_map.keys())[-limit:]
    return [
        {
            "key": key,
            "label": datetime.datetime.strptime(key, "%Y-%m-%d").strftime("%d/%m"),
            "total": counter_map[key],
        }
        for key in ordered_keys
    ]


def build_monthly_series(counter_map: Dict[str, int], *, limit: int = 12) -> List[Dict[str, Any]]:
    ordered_keys = sorted(counter_map.keys())[-limit:]
    return [
        {
            "key": key,
            "label": datetime.datetime.strptime(f"{key}-01", "%Y-%m-%d").strftime("%m/%Y"),
            "total": counter_map[key],
        }
        for key in ordered_keys
    ]

# --- MODELOS DE DADOS ---

class LoginRequest(BaseModel):
    analista_id: int
    senha: str


class ManagerLoginRequest(BaseModel):
    usuario: str
    senha: str

class AnalystCreate(BaseModel):
    nome: str
    senha: str
    permissoes: List[int]

class AnalystUpdate(BaseModel):
    nome: Optional[str] = None
    senha: Optional[str] = None
    permissoes: Optional[List[int]] = None
    status: Optional[str] = None

class StatusFilaRequest(BaseModel):
    analista_id: int
    online: bool

class TransferirPastaRequest(BaseModel):
    reserva_id: str
    analista_origem_id: int
    analista_destino_id: int
    motivo: str

class TransferirMassaRequest(BaseModel):
    reserva_ids: List[str]
    analista_origem_id: int
    analista_destino_id: int
    motivo: str


class ChangePasswordRequest(BaseModel):
    analista_id: int
    senha_atual: str
    nova_senha: str

# --- LÓGICA DE DISTRIBUIÇÃO ---

async def get_next_analyst(sit_id: int, exclude_ids: Optional[List[int]] = None):
    try:
        exclude_ids = exclude_ids or []
        response = supabase.table("analistas") \
            .select("*") \
            .eq("status", "ativo") \
            .eq("is_online", True) \
            .order("total_hoje", desc=False) \
            .order("ultima_atribuicao", desc=False) \
            .execute()
        
        if not response.data:
            return None

        for analista in response.data:
            if int(analista.get("id")) in [int(x) for x in exclude_ids]:
                continue
            permissoes = analista.get("permissoes") or []
            if int(sit_id) in [int(p) for p in permissoes]:
                return analista
    except Exception as e:
        print(f"Erro na fila de analistas: {e}")
    return None

async def perform_sync():
    ids_no_crm = []
    try:
        for sit_id in SITUACOES_IDS:
            response = await fetch_cvcrm_reservas(sit_id, timeout_seconds=15)
            
            if response.status_code == 204: continue
            if response.status_code != 200: continue
            
            data = response.json()
            items = data.items() if isinstance(data, dict) else enumerate(data)

            for key, info in items:
                res_id = str(info.get('idreserva') or info.get('id') or key)
                if not res_id or res_id == 'None': continue
                ids_no_crm.append(res_id)
                
                # Busca se já existe distribuição para esta reserva
                ativa = supabase.table("distribuicoes").select("*").eq("reserva_id", res_id).execute()
                
                if not ativa.data:
                    # NOVA DISTRIBUIÇÃO
                    analista = await get_next_analyst(sit_id)
                    if analista:
                        now = datetime.datetime.now().isoformat()
                        try:
                            # Garante que não está no histórico (caso tenha voltado ao CRM)
                            supabase.table("historico").delete().eq("reserva_id", res_id).execute()
                            
                            supabase.table("distribuicoes").insert({
                                "reserva_id": res_id,
                                "cliente": info.get('titular', {}).get('nome', 'Desconhecido'),
                                "empreendimento": info.get('unidade', {}).get('empreendimento', 'N/A'),
                                "unidade": info.get('unidade', {}).get('unidade', 'N/A'),
                                "situacao_id": sit_id,
                                "situacao_nome": SITUACOES_NOMES.get(sit_id, "Geral"),
                                "analista_id": analista["id"],
                                "data_atribuicao": now
                            }).execute()
                            
                            supabase.table("analistas").update({
                                "ultima_atribuicao": now,
                                "total_hoje": analista["total_hoje"] + 1
                            }).eq("id", analista["id"]).execute()
                        except Exception as e:
                            print(f"Erro ao gravar no banco: {e}")
                else:
                    # ATUALIZAÇÃO DE STATUS (RESOLVE O PROBLEMA DA PASTA 45815)
                    # Se a pasta já existe, verificamos se a situação mudou no CRM
                    dist_db = ativa.data[0]
                    analista_atual_id = dist_db.get("analista_id")

                    # AUTO-REASSIGN: se está sem analista ou com analista inativo/offline, tenta atribuir novamente.
                    # Permissões NÃO são verificadas aqui para preservar transferências manuais —
                    # um analista pode receber uma pasta por transferência mesmo sem a situação configurada.
                    deve_reatribuir = not analista_atual_id
                    if analista_atual_id:
                        analista_atual = supabase.table("analistas").select("*").eq("id", analista_atual_id).execute()
                        if not analista_atual.data:
                            deve_reatribuir = True
                        else:
                            a = analista_atual.data[0]
                            if a.get("status") != "ativo" or not a.get("is_online"):
                                deve_reatribuir = True

                    if deve_reatribuir:
                        proximo = await get_next_analyst(sit_id, exclude_ids=[analista_atual_id] if analista_atual_id else None)
                        if proximo:
                            now = datetime.datetime.now().isoformat()
                            supabase.table("distribuicoes").update({
                                "analista_id": proximo["id"],
                                "data_atribuicao": now,
                                "situacao_id": sit_id,
                                "situacao_nome": SITUACOES_NOMES.get(sit_id, "Geral")
                            }).eq("reserva_id", res_id).execute()

                            supabase.table("analistas").update({
                                "ultima_atribuicao": now,
                                "total_hoje": (proximo.get("total_hoje") or 0) + 1
                            }).eq("id", proximo["id"]).execute()
                        else:
                            supabase.table("distribuicoes").update({
                                "analista_id": None,
                                "data_atribuicao": None,
                                "situacao_id": sit_id,
                                "situacao_nome": SITUACOES_NOMES.get(sit_id, "Geral")
                            }).eq("reserva_id", res_id).execute()

                    if int(dist_db.get("situacao_id", 0)) != int(sit_id):
                        supabase.table("distribuicoes").update({
                            "situacao_id": sit_id,
                            "situacao_nome": SITUACOES_NOMES.get(sit_id, "Geral")
                        }).eq("reserva_id", res_id).execute()

        # REMOÇÃO: Se sumiu do CRM das situações monitoradas, apaga da mesa
        locais = supabase.table("distribuicoes").select("reserva_id").execute()
        if locais.data:
            for l in locais.data:
                if l["reserva_id"] not in ids_no_crm:
                    supabase.table("distribuicoes").delete().eq("reserva_id", l["reserva_id"]).execute()

    except Exception as e:
        print(f"Erro Geral Sync: {e}")

async def background_task():
    while True:
        await perform_sync()
        await asyncio.sleep(SYNC_INTERVAL_SECONDS)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(background_task())

# --- ENDPOINTS ---

@app.post("/api/gestor/redistribuir")
async def redistribute_all(authorization: Optional[str] = Header(default=None)):
    """Limpa as mesas e força uma nova distribuição do zero."""
    try:
        require_manager_auth(authorization)
        supabase.table("distribuicoes").delete().neq("reserva_id", "0").execute()
        await perform_sync()
        return {"status": "sucesso"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/gestor/zerar-dados")
async def reset_all_data(authorization: Optional[str] = Header(default=None)):
    """Limpa a mesa atual e reinicia a ordem de distribuição sem excluir histórico."""
    try:
        require_manager_auth(authorization)
        supabase.table("distribuicoes").delete().neq("reserva_id", "0").execute()
        supabase.table("analistas").update({
            "total_hoje": 0,
            "ultima_atribuicao": None
        }).neq("id", 0).execute()
        return {"status": "ok", "message": "Mesa limpa e ordem de distribuição reiniciada"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/gestor/login")
async def manager_login(req: ManagerLoginRequest):
    admin = verify_admin_credentials(req.usuario, req.senha)
    
    if not admin:
        raise HTTPException(status_code=401, detail="Usuário ou senha do admin inválidos")

    return {
        "usuario": admin.get("username"),
        "email": admin.get("email"),
        "token": create_manager_token(admin.get("username"))
    }


@app.post("/api/login")
async def login(req: LoginRequest):
    try:
        res = supabase.table("analistas").select("*").eq("id", req.analista_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")

        analista = res.data[0]
        senha_recebida = (req.senha or "").strip()
        senha_cadastrada = str(analista.get("senha") or "").strip()

        if not validate_analyst_password(req.analista_id, senha_recebida, senha_cadastrada):
            raise HTTPException(status_code=401, detail="Senha incorreta")
        return analista
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analista/alterar-senha")
async def change_password(req: ChangePasswordRequest):
    try:
        res = supabase.table("analistas").select("id,nome,senha").eq("id", req.analista_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")

        analyst = res.data[0]
        current_password = (req.senha_atual or "").strip()
        new_password = (req.nova_senha or "").strip()

        if not current_password or not new_password:
            raise HTTPException(status_code=400, detail="Preencha a senha atual e a nova senha")

        if not validate_analyst_password(req.analista_id, current_password, str(analyst.get("senha") or "")):
            raise HTTPException(status_code=401, detail="Senha atual incorreta")

        if hmac.compare_digest(current_password, new_password):
            raise HTTPException(status_code=400, detail="A nova senha deve ser diferente da senha atual")

        password_strength = evaluate_password_strength(new_password)
        if not password_strength["is_acceptable"]:
            raise HTTPException(status_code=400, detail="A nova senha está fraca. Use pelo menos 8 caracteres com combinação de letras, números e símbolos.")

        supabase.table("analistas").update({"senha": hash_password(new_password)}).eq("id", req.analista_id).execute()
        return {"status": "ok", "message": "Senha alterada com sucesso"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/analista/status-fila")
async def set_online_status(req: StatusFilaRequest):
    try:
        supabase.table("analistas").update({"is_online": req.online}).eq("id", req.analista_id).execute()

        redistribuidas = 0
        sem_destino = 0

        # Regra: ao ficar OFFLINE, redistribui as pastas da mesa dele para analistas ONLINE elegíveis
        if not req.online:
            mesa = supabase.table("distribuicoes").select("*").eq("analista_id", req.analista_id).execute()
            itens_mesa = mesa.data or []

            for item in itens_mesa:
                sit_id = int(item.get("situacao_id", 0))
                proximo = await get_next_analyst(sit_id, exclude_ids=[req.analista_id])
                if not proximo:
                    supabase.table("distribuicoes").update({
                        "analista_id": None,
                        "data_atribuicao": None
                    }).eq("reserva_id", item["reserva_id"]).execute()
                    sem_destino += 1
                    continue

                now = datetime.datetime.now().isoformat()
                supabase.table("distribuicoes").update({
                    "analista_id": proximo["id"],
                    "data_atribuicao": now
                }).eq("reserva_id", item["reserva_id"]).execute()

                supabase.table("analistas").update({
                    "ultima_atribuicao": now,
                    "total_hoje": (proximo.get("total_hoje") or 0) + 1
                }).eq("id", proximo["id"]).execute()

                redistribuidas += 1

        return {
            "status": "ok",
            "redistribuidas": redistribuidas,
            "sem_destino": sem_destino
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail="Erro ao atualizar status da fila")

@app.get("/api/analistas")
async def listar_analistas():
    try:
        res = supabase.table("analistas").select("*").order("nome").execute()
        return res.data or []
    except:
        return []

@app.get("/api/mesa/{analista_id}")
async def get_mesa(analista_id: int):
    res = supabase.table("distribuicoes").select("*").eq("analista_id", analista_id).execute()
    return res.data or []

@app.get("/api/metricas/{analista_id}")
async def get_metrics(analista_id: int):
    now = datetime.datetime.now()
    hoje_str = now.strftime("%Y-%m-%d")
    def count_period(since):
        q = supabase.table("historico").select("id", count="exact").eq("analista_id", analista_id).gte("data_fim", since).execute()
        return q.count or 0
    return {
        "hoje": count_period(hoje_str),
        "ano": count_period(now.strftime("%Y-01-01"))
    }

@app.get("/api/analista/dashboard/{analista_id}")
async def get_analyst_dashboard(analista_id: int):
    try:
        history_response = (
            supabase.table("historico")
            .select("reserva_id,cliente,empreendimento,unidade,resultado,data_fim", count="exact")
            .eq("analista_id", analista_id)
            .order("data_fim", desc=True)
            .limit(5000)
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao carregar dashboard analítico: {e}")

    raw_rows = history_response.data or []
    now = datetime.datetime.now()
    today = now.date()
    current_month = today.strftime("%Y-%m")
    current_year = today.strftime("%Y")

    total_por_dia: Dict[str, int] = {}
    total_por_mes: Dict[str, int] = {}
    total_por_resultado: Dict[str, int] = {}
    total_por_situacao: Dict[str, int] = {}
    total_por_empreendimento: Dict[str, int] = {}
    normalized_rows: List[Dict[str, Any]] = []

    total_hoje = 0
    total_mes = 0
    total_ano = 0

    for row in raw_rows:
        finished_at = parse_history_datetime(row.get("data_fim"))
        if not finished_at:
            continue

        finished_local = finished_at.astimezone() if finished_at.tzinfo else finished_at
        day_key = finished_local.strftime("%Y-%m-%d")
        month_key = finished_local.strftime("%Y-%m")
        year_key = finished_local.strftime("%Y")

        total_por_dia[day_key] = total_por_dia.get(day_key, 0) + 1
        total_por_mes[month_key] = total_por_mes.get(month_key, 0) + 1

        resultado = (row.get("resultado") or "Sem resultado").strip()
        empreendimento = (row.get("empreendimento") or "Não informado").strip()

        total_por_resultado[resultado] = total_por_resultado.get(resultado, 0) + 1
        total_por_empreendimento[empreendimento] = total_por_empreendimento.get(empreendimento, 0) + 1

        if finished_local.date() == today:
            total_hoje += 1
        if month_key == current_month:
            total_mes += 1
        if year_key == current_year:
            total_ano += 1

        normalized_rows.append({
            "reserva_id": row.get("reserva_id"),
            "cliente": row.get("cliente") or "Não informado",
            "empreendimento": empreendimento,
            "unidade": row.get("unidade") or "Não informado",
            "resultado": resultado,
            "data_fim": finished_local.isoformat(),
            "data_fim_label": finished_local.strftime("%d/%m/%Y %H:%M"),
        })

    dias_com_producao = len(total_por_dia)
    media_por_dia = round((len(normalized_rows) / dias_com_producao), 2) if dias_com_producao else 0

    return {
        "resumo": {
            "total": len(normalized_rows),
            "hoje": total_hoje,
            "mes": total_mes,
            "ano": total_ano,
            "media_por_dia": media_por_dia,
            "dias_com_producao": dias_com_producao,
        },
        "series": {
            "por_dia": build_daily_series(total_por_dia, limit=14),
            "por_mes": build_monthly_series(total_por_mes, limit=12),
        },
        "rankings": {
            "por_resultado": build_sorted_counter(total_por_resultado),
            "por_empreendimento": build_sorted_counter(total_por_empreendimento, limit=10),
        },
        "registros": normalized_rows,
        "total_registros": history_response.count or len(normalized_rows),
        "gerado_em": now.isoformat(),
    }

@app.post("/api/concluir")
async def concluir(reserva_id: str, resultado: str):
    dist = supabase.table("distribuicoes").select("*").eq("reserva_id", reserva_id).execute()
    if dist.data:
        d = dist.data[0]
        supabase.table("historico").insert({
            "reserva_id": d["reserva_id"], 
            "cliente": d["cliente"],
            "empreendimento": d["empreendimento"],
            "unidade": d["unidade"],
            "analista_id": d["analista_id"],
            "resultado": resultado,
            "data_fim": datetime.datetime.now().isoformat()
        }).execute()
        supabase.table("distribuicoes").delete().eq("reserva_id", d["reserva_id"]).execute()
    return {"status": "ok"}

@app.post("/api/analista/transferir")
async def transferir_pasta(req: TransferirPastaRequest):
    try:
        if int(req.analista_origem_id) == int(req.analista_destino_id):
            raise HTTPException(status_code=400, detail="Escolha outro analista para transferir")

        motivo_limpo = (req.motivo or "").strip()
        if not motivo_limpo:
            raise HTTPException(status_code=400, detail="Motivo da transferência é obrigatório")

        dist = supabase.table("distribuicoes") \
            .select("*") \
            .eq("reserva_id", req.reserva_id) \
            .eq("analista_id", req.analista_origem_id) \
            .execute()

        if not dist.data:
            raise HTTPException(status_code=404, detail="Pasta não encontrada na sua mesa")

        pasta = dist.data[0]
        situacao_id = int(pasta.get("situacao_id", 0))

        origem_res = supabase.table("analistas").select("id,nome").eq("id", req.analista_origem_id).execute()
        destino_res = supabase.table("analistas").select("*").eq("id", req.analista_destino_id).execute()

        if not destino_res.data:
            raise HTTPException(status_code=404, detail="Analista de destino não encontrado")

        origem = origem_res.data[0] if origem_res.data else {"id": req.analista_origem_id, "nome": f"Analista {req.analista_origem_id}"}
        destino = destino_res.data[0]

        if destino.get("status") != "ativo":
            raise HTTPException(status_code=400, detail="Analista de destino não está ativo")

        now = datetime.datetime.now().isoformat()

        supabase.table("distribuicoes").update({
            "analista_id": int(destino["id"]),
            "data_atribuicao": now
        }).eq("reserva_id", req.reserva_id).execute()

        supabase.table("analistas").update({
            "ultima_atribuicao": now,
            "total_hoje": (destino.get("total_hoje") or 0) + 1
        }).eq("id", destino["id"]).execute()

        try:
            supabase.table("logs_transferencias").insert({
                "reserva_id": str(req.reserva_id),
                "analista_origem_id": int(origem.get("id")),
                "analista_origem_nome": origem.get("nome"),
                "analista_destino_id": int(destino.get("id")),
                "analista_destino_nome": destino.get("nome"),
                "situacao_id": situacao_id,
                "situacao_nome": pasta.get("situacao_nome") or SITUACOES_NOMES.get(situacao_id, "Geral"),
                "cliente": pasta.get("cliente"),
                "empreendimento": pasta.get("empreendimento"),
                "unidade": pasta.get("unidade"),
                "motivo": motivo_limpo,
                "data_transferencia": now
            }).execute()
        except Exception as log_error:
            supabase.table("distribuicoes").update({
                "analista_id": int(req.analista_origem_id)
            }).eq("reserva_id", req.reserva_id).execute()

            log_error_message = str(log_error)
            if (
                "logs_transferencias" in log_error_message
                and (
                    "does not exist" in log_error_message
                    or "42P01" in log_error_message
                    or "PGRST205" in log_error_message
                    or "schema cache" in log_error_message
                )
            ):
                raise HTTPException(
                    status_code=500,
                    detail="Tabela de log não encontrada na API do Supabase. Execute o SQL em backend/logs_transferencias_schema.sql e tente novamente."
                )

            raise HTTPException(
                status_code=500,
                detail=f"Falha ao registrar log da transferência: {log_error_message}"
            )

        return {"status": "ok", "message": "Pasta transferida com sucesso"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analista/transferir-massa")
async def transferir_pasta_massa(req: TransferirMassaRequest):
    """Transfere múltiplas pastas de uma vez para o analista destino."""
    try:
        if int(req.analista_origem_id) == int(req.analista_destino_id):
            raise HTTPException(status_code=400, detail="Escolha outro analista para transferir")

        motivo_limpo = (req.motivo or "").strip()
        if not motivo_limpo:
            raise HTTPException(status_code=400, detail="Motivo da transferência é obrigatório")

        if not req.reserva_ids:
            raise HTTPException(status_code=400, detail="Nenhuma pasta selecionada")

        origem_res = supabase.table("analistas").select("id,nome").eq("id", req.analista_origem_id).execute()
        destino_res = supabase.table("analistas").select("*").eq("id", req.analista_destino_id).execute()

        if not destino_res.data:
            raise HTTPException(status_code=404, detail="Analista de destino não encontrado")

        destino = destino_res.data[0]
        if destino.get("status") != "ativo":
            raise HTTPException(status_code=400, detail="Analista de destino não está ativo")

        origem = origem_res.data[0] if origem_res.data else {"id": req.analista_origem_id, "nome": f"Analista {req.analista_origem_id}"}

        sucesso = []
        erros = []
        now = datetime.datetime.now().isoformat()

        for reserva_id in req.reserva_ids:
            try:
                dist = supabase.table("distribuicoes") \
                    .select("*") \
                    .eq("reserva_id", reserva_id) \
                    .eq("analista_id", req.analista_origem_id) \
                    .execute()

                if not dist.data:
                    erros.append({"reserva_id": reserva_id, "motivo": "Pasta não encontrada na mesa de origem"})
                    continue

                pasta = dist.data[0]
                situacao_id = int(pasta.get("situacao_id", 0))

                supabase.table("distribuicoes").update({
                    "analista_id": int(destino["id"]),
                    "data_atribuicao": now
                }).eq("reserva_id", reserva_id).execute()

                try:
                    supabase.table("logs_transferencias").insert({
                        "reserva_id": str(reserva_id),
                        "analista_origem_id": int(origem.get("id")),
                        "analista_origem_nome": origem.get("nome"),
                        "analista_destino_id": int(destino.get("id")),
                        "analista_destino_nome": destino.get("nome"),
                        "situacao_id": situacao_id,
                        "situacao_nome": pasta.get("situacao_nome") or SITUACOES_NOMES.get(situacao_id, "Geral"),
                        "cliente": pasta.get("cliente"),
                        "empreendimento": pasta.get("empreendimento"),
                        "unidade": pasta.get("unidade"),
                        "motivo": motivo_limpo,
                        "data_transferencia": now
                    }).execute()
                except Exception:
                    # Reverte a transferência desta pasta se o log falhar
                    supabase.table("distribuicoes").update({
                        "analista_id": int(req.analista_origem_id)
                    }).eq("reserva_id", reserva_id).execute()
                    erros.append({"reserva_id": reserva_id, "motivo": "Falha ao registrar log"})
                    continue

                sucesso.append(reserva_id)
            except Exception as e:
                erros.append({"reserva_id": reserva_id, "motivo": str(e)})

        if sucesso:
            supabase.table("analistas").update({
                "ultima_atribuicao": now,
                "total_hoje": (destino.get("total_hoje") or 0) + len(sucesso)
            }).eq("id", destino["id"]).execute()

        return {
            "status": "ok",
            "transferidas": len(sucesso),
            "erros": len(erros),
            "detalhes_erros": erros
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/gestor/overview")
async def manager_overview(
    logs_limit: int = Query(default=200, ge=1, le=1000),
    logs_offset: int = Query(default=0, ge=0),
    authorization: Optional[str] = Header(default=None),
):
    require_manager_auth(authorization)
    total_crm = 0
    for sit_id in SITUACOES_IDS:
        try:
            r = await fetch_cvcrm_reservas(sit_id, timeout_seconds=4)
            if r.status_code == 200:
                d = r.json()
                total_crm += len(d) if isinstance(d, list) else len(d.keys())
        except: pass
    
    equipe = supabase.table("analistas").select("*").order("nome").execute().data or []
    distribuicao_atual = supabase.table("distribuicoes").select("*").execute().data or []
    historico_recente = supabase.table("historico").select("*").order("data_fim", desc=True).limit(100).execute().data or []
    try:
        logs_query = (
            supabase.table("logs_transferencias")
            .select("*", count="exact")
            .order("data_transferencia", desc=True)
            .range(logs_offset, logs_offset + logs_limit - 1)
            .execute()
        )
        logs_transferencias = logs_query.data or []
        logs_total = logs_query.count or 0
    except Exception:
        logs_transferencias = []
        logs_total = 0
    pastas_sem_destino = sum(1 for item in distribuicao_atual if not item.get("analista_id"))

    return {
        "equipe": equipe, 
        "total_pendente_cvcrm": total_crm,
        "distribuicao_atual": distribuicao_atual,
        "historico_recente": historico_recente,
        "logs_transferencias": logs_transferencias,
        "logs_transferencias_total": logs_total,
        "logs_limit": logs_limit,
        "logs_offset": logs_offset,
        "pastas_sem_destino": pastas_sem_destino
    }

@app.post("/api/gestor/analistas")
async def create_analyst(req: AnalystCreate, authorization: Optional[str] = Header(default=None)):
    try:
        require_manager_auth(authorization)
        res = supabase.table("analistas").insert({
            "nome": req.nome,
            "senha": hash_password(req.senha),
            "permissoes": req.permissoes,
            "status": "ativo", "is_online": False, "total_hoje": 0
        }).execute()
        return res.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/api/gestor/analistas/{id}")
async def update_analyst(id: int, req: AnalystUpdate, authorization: Optional[str] = Header(default=None)):
    try:
        require_manager_auth(authorization)
        data = {k: v for k, v in req.dict().items() if v is not None}
        if "senha" in data:
            data["senha"] = hash_password(str(data["senha"]))
        res = supabase.table("analistas").update(data).eq("id", id).execute()
        return res.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/gestor/analistas/{id}")
async def delete_analyst(id: int, authorization: Optional[str] = Header(default=None)):
    try:
        require_manager_auth(authorization)
        supabase.table("analistas").delete().eq("id", id).execute()
        return {"status": "removido"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)