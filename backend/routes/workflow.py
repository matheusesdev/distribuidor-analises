import datetime
from typing import Optional
from fastapi import APIRouter, Header, HTTPException
from app_core.db import supabase, SITUACOES_NOMES, HISTORICO_HAS_ANALISTA_NOME, HISTORICO_HAS_SITUACAO_ID, HISTORICO_HAS_SITUACAO_NOME
from domain.analysts import build_next_total_hoje
from domain.models import TransferirMassaRequest, TransferirPastaRequest
from security.deps import require_analyst_auth

router = APIRouter()

@router.post("/api/concluir")
async def concluir(reserva_id: str, resultado: str, authorization: Optional[str] = Header(default=None)):
    auth_payload = require_analyst_auth(authorization)
    dist = supabase.table("distribuicoes").select("*").eq("reserva_id", reserva_id).execute()
    if not dist.data: raise HTTPException(status_code=404, detail="Reserva nao encontrada na mesa atual")
    d = dist.data[0]
    if int(d.get("analista_id") or 0) != int(auth_payload.get("user_id") or 0):
        raise HTTPException(status_code=403, detail="Voce nao tem permissao para concluir esta reserva")
    payload = {"reserva_id": d["reserva_id"], "cliente": d["cliente"], "empreendimento": d["empreendimento"], "unidade": d["unidade"], "analista_id": d["analista_id"], "resultado": resultado, "data_fim": datetime.datetime.now().isoformat()}
    if HISTORICO_HAS_ANALISTA_NOME and d.get("analista_id") is not None:
        ar = supabase.table("analistas").select("nome").eq("id", d["analista_id"]).limit(1).execute()
        if ar.data: payload["analista_nome"] = ar.data[0].get("nome")
    if HISTORICO_HAS_SITUACAO_ID: payload["situacao_id"] = d.get("situacao_id")
    if HISTORICO_HAS_SITUACAO_NOME: payload["situacao_nome"] = d.get("situacao_nome") or SITUACOES_NOMES.get(int(d.get("situacao_id") or 0), "Nao informado")
    supabase.table("historico").insert(payload).execute()
    supabase.table("distribuicoes").delete().eq("reserva_id", d["reserva_id"]).execute()
    return {"status": "ok"}

@router.post("/api/analista/transferir")
async def transferir_pasta(req: TransferirPastaRequest, authorization: Optional[str] = Header(default=None)):
    try:
        require_analyst_auth(authorization, expected_analyst_id=req.analista_origem_id)
        if int(req.analista_origem_id) == int(req.analista_destino_id): raise HTTPException(status_code=400, detail="Escolha outro analista para transferir")
        motivo = (req.motivo or "").strip()
        if not motivo: raise HTTPException(status_code=400, detail="Motivo da transferencia e obrigatorio")
        dist = supabase.table("distribuicoes").select("*").eq("reserva_id", req.reserva_id).eq("analista_id", req.analista_origem_id).execute()
        if not dist.data: raise HTTPException(status_code=404, detail="Pasta nao encontrada na sua mesa")
        pasta = dist.data[0]; sit_id = int(pasta.get("situacao_id", 0))
        origem_res = supabase.table("analistas").select("id,nome").eq("id", req.analista_origem_id).execute()
        destino_res = supabase.table("analistas").select("*").eq("id", req.analista_destino_id).execute()
        if not destino_res.data: raise HTTPException(status_code=404, detail="Analista de destino nao encontrado")
        origem = origem_res.data[0] if origem_res.data else {"id": req.analista_origem_id, "nome": f"Analista {req.analista_origem_id}"}
        destino = destino_res.data[0]
        if destino.get("status") != "ativo": raise HTTPException(status_code=400, detail="Analista de destino nao esta ativo")
        now = datetime.datetime.now().isoformat()
        supabase.table("distribuicoes").update({"analista_id": int(destino["id"]), "data_atribuicao": now}).eq("reserva_id", req.reserva_id).execute()
        supabase.table("analistas").update({"ultima_atribuicao": now, "total_hoje": build_next_total_hoje(destino)}).eq("id", destino["id"]).execute()
        try:
            supabase.table("logs_transferencias").insert({"reserva_id": str(req.reserva_id), "analista_origem_id": int(origem.get("id")), "analista_origem_nome": origem.get("nome"), "analista_destino_id": int(destino.get("id")), "analista_destino_nome": destino.get("nome"), "situacao_id": sit_id, "situacao_nome": pasta.get("situacao_nome") or SITUACOES_NOMES.get(sit_id, "Geral"), "cliente": pasta.get("cliente"), "empreendimento": pasta.get("empreendimento"), "unidade": pasta.get("unidade"), "motivo": motivo, "data_transferencia": now}).execute()
        except Exception as log_error:
            supabase.table("distribuicoes").update({"analista_id": int(req.analista_origem_id)}).eq("reserva_id", req.reserva_id).execute()
            le = str(log_error)
            if "logs_transferencias" in le and any(k in le for k in ("does not exist", "42P01", "PGRST205", "schema cache")):
                raise HTTPException(status_code=500, detail="Tabela de log nao encontrada. Execute a migration 002_logs_transferencias_schema.sql.")
            raise HTTPException(status_code=500, detail=f"Falha ao registrar log da transferencia: {le}")
        return {"status": "ok", "message": "Pasta transferida com sucesso"}
    except HTTPException: raise
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/analista/transferir-massa")
async def transferir_pasta_massa(req: TransferirMassaRequest, authorization: Optional[str] = Header(default=None)):
    try:
        require_analyst_auth(authorization, expected_analyst_id=req.analista_origem_id)
        if int(req.analista_origem_id) == int(req.analista_destino_id): raise HTTPException(status_code=400, detail="Escolha outro analista para transferir")
        motivo = (req.motivo or "").strip()
        if not motivo: raise HTTPException(status_code=400, detail="Motivo da transferencia e obrigatorio")
        if not req.reserva_ids: raise HTTPException(status_code=400, detail="Nenhuma pasta selecionada")
        origem_res = supabase.table("analistas").select("id,nome").eq("id", req.analista_origem_id).execute()
        destino_res = supabase.table("analistas").select("*").eq("id", req.analista_destino_id).execute()
        if not destino_res.data: raise HTTPException(status_code=404, detail="Analista de destino nao encontrado")
        destino = destino_res.data[0]
        if destino.get("status") != "ativo": raise HTTPException(status_code=400, detail="Analista de destino nao esta ativo")
        origem = origem_res.data[0] if origem_res.data else {"id": req.analista_origem_id, "nome": f"Analista {req.analista_origem_id}"}
        sucesso = []; erros = []; now = datetime.datetime.now().isoformat()
        for reserva_id in req.reserva_ids:
            try:
                dist = supabase.table("distribuicoes").select("*").eq("reserva_id", reserva_id).eq("analista_id", req.analista_origem_id).execute()
                if not dist.data: erros.append({"reserva_id": reserva_id, "motivo": "Pasta nao encontrada na mesa de origem"}); continue
                pasta = dist.data[0]; sit_id = int(pasta.get("situacao_id", 0))
                supabase.table("distribuicoes").update({"analista_id": int(destino["id"]), "data_atribuicao": now}).eq("reserva_id", reserva_id).execute()
                try:
                    supabase.table("logs_transferencias").insert({"reserva_id": str(reserva_id), "analista_origem_id": int(origem.get("id")), "analista_origem_nome": origem.get("nome"), "analista_destino_id": int(destino.get("id")), "analista_destino_nome": destino.get("nome"), "situacao_id": sit_id, "situacao_nome": pasta.get("situacao_nome") or SITUACOES_NOMES.get(sit_id, "Geral"), "cliente": pasta.get("cliente"), "empreendimento": pasta.get("empreendimento"), "unidade": pasta.get("unidade"), "motivo": motivo, "data_transferencia": now}).execute()
                except Exception:
                    supabase.table("distribuicoes").update({"analista_id": int(req.analista_origem_id)}).eq("reserva_id", reserva_id).execute()
                    erros.append({"reserva_id": reserva_id, "motivo": "Falha ao registrar log"}); continue
                sucesso.append(reserva_id)
            except Exception as e: erros.append({"reserva_id": reserva_id, "motivo": str(e)})
        if sucesso:
            supabase.table("analistas").update({"ultima_atribuicao": now, "total_hoje": build_next_total_hoje(destino, increment=len(sucesso))}).eq("id", destino["id"]).execute()
        return {"status": "ok", "transferidas": len(sucesso), "erros": len(erros), "detalhes_erros": erros}
    except HTTPException: raise
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))