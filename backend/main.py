from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import requests
import datetime
import asyncio
import os
import base64
import binascii
import hashlib
import hmac
from typing import List, Optional
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


load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

ALLOWED_ORIGINS = parse_allowed_origins(os.getenv("ALLOWED_ORIGINS", "http://localhost:5173"))
SYNC_INTERVAL_SECONDS = int(os.getenv("SYNC_INTERVAL_SECONDS", "25"))
PORT = int(os.getenv("PORT", "8000"))

SUPABASE_URL = get_required_env("SUPABASE_URL")
SUPABASE_KEY = get_required_env("SUPABASE_KEY")
CVCRM_EMAIL = get_required_env("CVCRM_EMAIL")
CVCRM_TOKEN = get_required_env("CVCRM_TOKEN")

app = FastAPI(title="VCA Distribuidor - Backend Oficial")

# Configuração de CORS para o Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- CONFIGURAÇÃO SUPABASE ---
try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("✓ Conexão com Supabase estabelecida.")
except Exception as e:
    print(f"✗ Erro ao ligar ao Supabase: {e}")

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

# --- MODELOS DE DADOS ---

class LoginRequest(BaseModel):
    analista_id: int
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
            url = f"https://vca.cvcrm.com.br/api/v1/comercial/reservas?situacao={sit_id}"
            response = requests.get(url, headers=HEADERS, timeout=15)
            
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

                    # AUTO-REASSIGN: se está sem analista ou com analista não elegível, tenta atribuir novamente
                    deve_reatribuir = not analista_atual_id
                    if analista_atual_id:
                        analista_atual = supabase.table("analistas").select("*").eq("id", analista_atual_id).execute()
                        if not analista_atual.data:
                            deve_reatribuir = True
                        else:
                            a = analista_atual.data[0]
                            permissoes = a.get("permissoes") or []
                            if a.get("status") != "ativo" or not a.get("is_online") or int(sit_id) not in [int(p) for p in permissoes]:
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
async def redistribute_all():
    """Limpa as mesas e força uma nova distribuição do zero."""
    try:
        supabase.table("distribuicoes").delete().neq("reserva_id", "0").execute()
        await perform_sync()
        return {"status": "sucesso"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/gestor/zerar-dados")
async def reset_all_data():
    """Limpa a mesa atual e reinicia a ordem de distribuição sem excluir histórico."""
    try:
        supabase.table("distribuicoes").delete().neq("reserva_id", "0").execute()
        supabase.table("analistas").update({
            "total_hoje": 0,
            "ultima_atribuicao": None
        }).neq("id", 0).execute()
        return {"status": "ok", "message": "Mesa limpa e ordem de distribuição reiniciada"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/login")
async def login(req: LoginRequest):
    try:
        res = supabase.table("analistas").select("*").eq("id", req.analista_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")

        analista = res.data[0]
        senha_recebida = (req.senha or "").strip()
        senha_cadastrada = str(analista.get("senha") or "").strip()

        senha_valida = verify_password(senha_recebida, senha_cadastrada)
        # Compatibilidade para migrar senhas legadas em texto puro no primeiro login valido.
        if not senha_valida and senha_recebida == senha_cadastrada:
            nova_senha_hash = hash_password(senha_recebida)
            supabase.table("analistas").update({"senha": nova_senha_hash}).eq("id", req.analista_id).execute()
            analista["senha"] = nova_senha_hash
            senha_valida = True

        if not senha_valida:
            raise HTTPException(status_code=401, detail="Senha incorreta")
        return analista
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

        permissoes_destino = destino.get("permissoes") or []
        destino_elegivel = (
            destino.get("status") == "ativo"
            and bool(destino.get("is_online"))
            and situacao_id in [int(p) for p in permissoes_destino]
        )

        if not destino_elegivel:
            raise HTTPException(status_code=400, detail="Analista de destino não está elegível para esta pasta")

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

@app.get("/api/gestor/overview")
async def manager_overview():
    total_crm = 0
    for sit_id in SITUACOES_IDS:
        try:
            r = requests.get(f"https://vca.cvcrm.com.br/api/v1/comercial/reservas?situacao={sit_id}", headers=HEADERS, timeout=4)
            if r.status_code == 200:
                d = r.json()
                total_crm += len(d) if isinstance(d, list) else len(d.keys())
        except: pass
    
    equipe = supabase.table("analistas").select("*").order("nome").execute().data or []
    distribuicao_atual = supabase.table("distribuicoes").select("*").execute().data or []
    historico_recente = supabase.table("historico").select("*").order("data_fim", desc=True).limit(100).execute().data or []
    try:
        logs_transferencias = supabase.table("logs_transferencias").select("*").order("data_transferencia", desc=True).limit(1000).execute().data or []
    except Exception:
        logs_transferencias = []
    pastas_sem_destino = sum(1 for item in distribuicao_atual if not item.get("analista_id"))

    return {
        "equipe": equipe, 
        "total_pendente_cvcrm": total_crm,
        "distribuicao_atual": distribuicao_atual,
        "historico_recente": historico_recente,
        "logs_transferencias": logs_transferencias,
        "pastas_sem_destino": pastas_sem_destino
    }

@app.post("/api/gestor/analistas")
async def create_analyst(req: AnalystCreate):
    try:
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
async def update_analyst(id: int, req: AnalystUpdate):
    try:
        data = {k: v for k, v in req.dict().items() if v is not None}
        if "senha" in data:
            data["senha"] = hash_password(str(data["senha"]))
        res = supabase.table("analistas").update(data).eq("id", id).execute()
        return res.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/gestor/analistas/{id}")
async def delete_analyst(id: int):
    try:
        supabase.table("analistas").delete().eq("id", id).execute()
        return {"status": "removido"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)