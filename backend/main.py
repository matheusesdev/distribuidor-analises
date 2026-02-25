from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import requests
import datetime
import asyncio
from typing import List, Optional
from supabase import create_client, Client
from pydantic import BaseModel

app = FastAPI(title="VCA Distribuidor - Backend Oficial")

# Configuração de CORS para o Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- CONFIGURAÇÃO SUPABASE ---
SUPABASE_URL = "https://owomaqpsyikqxlzspqif.supabase.co"
SUPABASE_KEY = "sb_secret_pEcTuWzLbtOXMRRAMpWhtw_aXMFuNGl"

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
    "email": "matheus.espiritosanto@vcaconstrutora.com.br",
    "token": "005d066ae51acbb8e8ba5af5ee7ba5753d2319b5",
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
        await asyncio.sleep(25)

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
        res = supabase.table("analistas").select("*").eq("id", req.analista_id).eq("senha", req.senha).execute()
        if not res.data:
            raise HTTPException(status_code=401, detail="Senha incorreta")
        return res.data[0]
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
    pastas_sem_destino = sum(1 for item in distribuicao_atual if not item.get("analista_id"))

    return {
        "equipe": equipe, 
        "total_pendente_cvcrm": total_crm,
        "distribuicao_atual": distribuicao_atual,
        "historico_recente": historico_recente,
        "pastas_sem_destino": pastas_sem_destino
    }

@app.post("/api/gestor/analistas")
async def create_analyst(req: AnalystCreate):
    try:
        res = supabase.table("analistas").insert({
            "nome": req.nome, "senha": req.senha, "permissoes": req.permissoes, 
            "status": "ativo", "is_online": False, "total_hoje": 0
        }).execute()
        return res.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/api/gestor/analistas/{id}")
async def update_analyst(id: int, req: AnalystUpdate):
    try:
        data = {k: v for k, v in req.dict().items() if v is not None}
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
    uvicorn.run(app, host="0.0.0.0", port=8000)