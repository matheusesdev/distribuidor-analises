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

async def get_next_analyst(sit_id: int):
    try:
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
                
                ativa = supabase.table("distribuicoes").select("reserva_id").eq("reserva_id", res_id).execute()
                
                if not ativa.data:
                    analista = await get_next_analyst(sit_id)
                    if analista:
                        now = datetime.datetime.now().isoformat()
                        try:
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
        return {"status": "ok"}
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
    def count_period(since):
        q = supabase.table("historico").select("id", count="exact").eq("analista_id", analista_id).gte("data_fim", since).execute()
        return q.count or 0
    return {
        "hoje": count_period(now.strftime("%Y-%m-%d")),
        "ano": count_period(now.strftime("%Y-01-01"))
    }

@app.post("/api/concluir")
async def concluir(reserva_id: str, resultado: str):
    dist = supabase.table("distribuicoes").select("*, analistas(nome)").eq("reserva_id", reserva_id).execute()
    if dist.data:
        d = dist.data[0]
        supabase.table("historico").insert({
            "reserva_id": d["reserva_id"], "cliente": d["cliente"],
            "analista_nome": d.get("analistas", {}).get("nome"),
            "analista_id": d["analista_id"], "resultado": resultado
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
    return {"equipe": equipe, "total_pendente_cvcrm": total_crm}

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