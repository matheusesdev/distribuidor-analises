import datetime
from typing import Optional
import hmac
from fastapi import APIRouter, Header, HTTPException
from app_core.db import supabase
from domain.analysts import build_next_total_hoje, get_next_analyst, reconcile_analyst_mesa_against_current_permissions, validate_analyst_password
from domain.models import ChangePasswordRequest, StatusFilaRequest
from security.deps import require_analyst_auth
from security.passwords import evaluate_password_strength, hash_password
from security.sessions import bump_session_version, serialize_analyst_public
from security.tokens import verify_manager_token

router = APIRouter()

@router.post("/api/analista/alterar-senha")
async def change_password(req: ChangePasswordRequest, authorization: Optional[str] = Header(default=None)):
    try:
        require_analyst_auth(authorization, expected_analyst_id=req.analista_id)
        res = supabase.table("analistas").select("id,nome,senha").eq("id", req.analista_id).execute()
        if not res.data: raise HTTPException(status_code=404, detail="Usuario nao encontrado")
        analyst = res.data[0]
        current_pw = (req.senha_atual or "").strip()
        new_pw = (req.nova_senha or "").strip()
        if not current_pw or not new_pw: raise HTTPException(status_code=400, detail="Preencha a senha atual e a nova senha")
        if not validate_analyst_password(req.analista_id, current_pw, str(analyst.get("senha") or "")):
            raise HTTPException(status_code=401, detail="Senha atual incorreta")
        if hmac.compare_digest(current_pw, new_pw): raise HTTPException(status_code=400, detail="A nova senha deve ser diferente da senha atual")
        strength = evaluate_password_strength(new_pw)
        if not strength["is_acceptable"]: raise HTTPException(status_code=400, detail="A nova senha esta fraca.")
        supabase.table("analistas").update({"senha": hash_password(new_pw)}).eq("id", req.analista_id).execute()
        bump_session_version("analyst", int(req.analista_id))
        return {"status": "ok", "message": "Senha alterada com sucesso"}
    except HTTPException: raise
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/analista/status-fila")
async def set_online_status(req: StatusFilaRequest, authorization: Optional[str] = Header(default=None)):
    try:
        if not authorization: raise HTTPException(status_code=401, detail="Autenticacao obrigatoria para alterar status da fila")
        scheme, _, token = authorization.partition(" ")
        authorized_as_admin = scheme.lower() == "bearer" and bool(verify_manager_token(token))
        if not authorized_as_admin: require_analyst_auth(authorization, expected_analyst_id=req.analista_id)
        supabase.table("analistas").update({"is_online": req.online}).eq("id", req.analista_id).execute()
        redistribuidas = 0; sem_destino = 0
        if not req.online:
            mesa = supabase.table("distribuicoes").select("*").eq("analista_id", req.analista_id).execute()
            for item in mesa.data or []:
                sit_id = int(item.get("situacao_id", 0))
                proximo = await get_next_analyst(sit_id, exclude_ids=[req.analista_id])
                now = datetime.datetime.now().isoformat()
                if not proximo:
                    supabase.table("distribuicoes").update({"analista_id": None, "data_atribuicao": None}).eq("reserva_id", item["reserva_id"]).execute()
                    sem_destino += 1
                else:
                    supabase.table("distribuicoes").update({"analista_id": proximo["id"], "data_atribuicao": now}).eq("reserva_id", item["reserva_id"]).execute()
                    supabase.table("analistas").update({"ultima_atribuicao": now, "total_hoje": build_next_total_hoje(proximo)}).eq("id", proximo["id"]).execute()
                    redistribuidas += 1
        return {"status": "ok", "redistribuidas": redistribuidas, "sem_destino": sem_destino}
    except Exception as e: raise HTTPException(status_code=500, detail="Erro ao atualizar status da fila")