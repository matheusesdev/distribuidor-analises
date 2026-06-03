import datetime
from typing import Optional
from fastapi import APIRouter, Header, HTTPException
from app_core.db import supabase
from domain.models import SuggestionAdminResponseRequest, SuggestionCreateRequest, SuggestionStatusUpdateRequest, SuggestionUpdateRequest
from domain.suggestions import coerce_suggestion_status, is_missing_suggestions_column_error, is_missing_suggestions_table_error, normalize_suggestion_status
from app_core.db import SUGGESTION_STATUS_SET, SUGGESTION_STATUS_FLOW
from security.deps import require_analyst_auth, require_manager_auth
from security.sessions import get_admin_identity

router = APIRouter()

MISSING_TABLE_MSG = "Tabela de sugestoes nao encontrada. Execute a migration 008_sugestoes_melhoria_schema.sql."
MISSING_SCHEMA_MSG = "Schema de sugestoes desatualizado. Execute a migration 009_sugestoes_melhoria_campos_adicionais.sql."

@router.get("/api/sugestoes")
async def list_suggestions(authorization: Optional[str] = Header(default=None)):
    auth_payload = require_analyst_auth(authorization)
    analyst_id = int(auth_payload.get("user_id") or 0)
    try:
        suggestions = supabase.table("sugestoes_melhoria").select("*").eq("autor_analista_id", analyst_id).order("created_at", desc=False).execute().data or []
    except Exception as exc:
        msg = str(exc)
        if is_missing_suggestions_table_error(msg): raise HTTPException(status_code=500, detail=MISSING_TABLE_MSG)
        raise HTTPException(status_code=500, detail=f"Falha ao listar sugestoes: {msg}")
    return [{**dict(item), "status": normalize_suggestion_status(item.get("status"))} for item in suggestions]

@router.post("/api/sugestoes")
async def create_suggestion(req: SuggestionCreateRequest, authorization: Optional[str] = Header(default=None)):
    auth_payload = require_analyst_auth(authorization)
    titulo = (req.titulo or "").strip(); detalhes = (req.detalhes or "").strip()
    if not titulo: raise HTTPException(status_code=400, detail="Titulo da sugestao e obrigatorio")
    if not detalhes: raise HTTPException(status_code=400, detail="Detalhes da sugestao sao obrigatorios")
    if len(titulo) > 180: raise HTTPException(status_code=400, detail="Titulo deve ter no maximo 180 caracteres")
    if len(detalhes) > 3000: raise HTTPException(status_code=400, detail="Detalhes devem ter no maximo 3000 caracteres")
    analyst_id = int(auth_payload.get("user_id"))
    analyst_response = supabase.table("analistas").select("id,nome").eq("id", analyst_id).limit(1).execute()
    if not analyst_response.data: raise HTTPException(status_code=404, detail="Analista nao encontrado para registrar sugestao")
    analyst = analyst_response.data[0]
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    payload = {"titulo": titulo, "detalhes": detalhes, "status": "Em analise", "autor_analista_id": int(analyst.get("id") or analyst_id), "autor_nome": analyst.get("nome") or f"Analista {analyst_id}", "created_at": now_iso, "updated_at": now_iso}
    try:
        created = supabase.table("sugestoes_melhoria").insert(payload).execute().data or []
    except Exception as exc:
        msg = str(exc)
        if is_missing_suggestions_table_error(msg): raise HTTPException(status_code=500, detail=MISSING_TABLE_MSG)
        raise HTTPException(status_code=500, detail=f"Falha ao criar sugestao: {msg}")
    item = dict(created[0] if created else payload)
    item["status"] = normalize_suggestion_status(item.get("status"))
    return {"status": "ok", "sugestao": item}

@router.patch("/api/sugestoes/{sugestao_id}")
async def update_suggestion(sugestao_id: int, req: SuggestionUpdateRequest, authorization: Optional[str] = Header(default=None)):
    auth_payload = require_analyst_auth(authorization)
    analyst_id = int(auth_payload.get("user_id") or 0)
    titulo = (req.titulo or "").strip() if req.titulo is not None else None
    detalhes = (req.detalhes or "").strip() if req.detalhes is not None else None
    if titulo is None and detalhes is None: raise HTTPException(status_code=400, detail="Informe pelo menos um campo para atualizar")
    if titulo is not None and not titulo: raise HTTPException(status_code=400, detail="Titulo da sugestao e obrigatorio")
    if detalhes is not None and not detalhes: raise HTTPException(status_code=400, detail="Detalhes da sugestao sao obrigatorios")
    if titulo is not None and len(titulo) > 180: raise HTTPException(status_code=400, detail="Titulo deve ter no maximo 180 caracteres")
    if detalhes is not None and len(detalhes) > 3000: raise HTTPException(status_code=400, detail="Detalhes devem ter no maximo 3000 caracteres")
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    try:
        existing = supabase.table("sugestoes_melhoria").select("*").eq("id", sugestao_id).eq("autor_analista_id", analyst_id).limit(1).execute().data or []
        if not existing: raise HTTPException(status_code=404, detail="Sugestao nao encontrada")
        if bool(existing[0].get("cancelada")): raise HTTPException(status_code=409, detail="Sugestao cancelada nao pode ser editada")
        update_payload = {"updated_at": now_iso}
        if titulo is not None: update_payload["titulo"] = titulo
        if detalhes is not None: update_payload["detalhes"] = detalhes
        supabase.table("sugestoes_melhoria").update(update_payload).eq("id", sugestao_id).execute()
        updated = supabase.table("sugestoes_melhoria").select("*").eq("id", sugestao_id).limit(1).execute().data or []
    except HTTPException: raise
    except Exception as exc:
        msg = str(exc)
        if is_missing_suggestions_table_error(msg): raise HTTPException(status_code=500, detail=MISSING_TABLE_MSG)
        if is_missing_suggestions_column_error(msg, "cancelada"): raise HTTPException(status_code=500, detail=MISSING_SCHEMA_MSG)
        raise HTTPException(status_code=500, detail=f"Falha ao editar sugestao: {msg}")
    item = dict(updated[0]) if updated else {"id": sugestao_id, "updated_at": now_iso}
    item["status"] = normalize_suggestion_status(item.get("status"))
    return {"status": "ok", "sugestao": item}

@router.patch("/api/sugestoes/{sugestao_id}/cancelar")
async def cancel_suggestion(sugestao_id: int, authorization: Optional[str] = Header(default=None)):
    auth_payload = require_analyst_auth(authorization)
    analyst_id = int(auth_payload.get("user_id") or 0)
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    try:
        existing = supabase.table("sugestoes_melhoria").select("*").eq("id", sugestao_id).eq("autor_analista_id", analyst_id).limit(1).execute().data or []
        if not existing: raise HTTPException(status_code=404, detail="Sugestao nao encontrada")
        if bool(existing[0].get("cancelada")): raise HTTPException(status_code=409, detail="Sugestao ja esta cancelada")
        supabase.table("sugestoes_melhoria").update({"cancelada": True, "cancelada_at": now_iso, "updated_at": now_iso}).eq("id", sugestao_id).execute()
        updated = supabase.table("sugestoes_melhoria").select("*").eq("id", sugestao_id).limit(1).execute().data or []
    except HTTPException: raise
    except Exception as exc:
        msg = str(exc)
        if is_missing_suggestions_table_error(msg): raise HTTPException(status_code=500, detail=MISSING_TABLE_MSG)
        if is_missing_suggestions_column_error(msg, "cancelada") or is_missing_suggestions_column_error(msg, "cancelada_at"): raise HTTPException(status_code=500, detail=MISSING_SCHEMA_MSG)
        raise HTTPException(status_code=500, detail=f"Falha ao cancelar sugestao: {msg}")
    item = dict(updated[0]) if updated else {"id": sugestao_id, "cancelada": True, "cancelada_at": now_iso}
    item["status"] = normalize_suggestion_status(item.get("status"))
    return {"status": "ok", "sugestao": item}

@router.delete("/api/sugestoes/{sugestao_id}")
async def delete_suggestion(sugestao_id: int, authorization: Optional[str] = Header(default=None)):
    auth_payload = require_analyst_auth(authorization)
    analyst_id = int(auth_payload.get("user_id") or 0)
    try:
        existing = supabase.table("sugestoes_melhoria").select("id").eq("id", sugestao_id).eq("autor_analista_id", analyst_id).limit(1).execute().data or []
        if not existing: raise HTTPException(status_code=404, detail="Sugestao nao encontrada")
        supabase.table("sugestoes_melhoria").delete().eq("id", sugestao_id).execute()
    except HTTPException: raise
    except Exception as exc:
        msg = str(exc)
        if is_missing_suggestions_table_error(msg): raise HTTPException(status_code=500, detail=MISSING_TABLE_MSG)
        raise HTTPException(status_code=500, detail=f"Falha ao excluir sugestao: {msg}")
    return {"status": "ok", "id": sugestao_id}

@router.get("/api/gestor/sugestoes")
async def manager_list_suggestions(authorization: Optional[str] = Header(default=None)):
    require_manager_auth(authorization)
    try:
        suggestions = supabase.table("sugestoes_melhoria").select("*").order("created_at", desc=False).execute().data or []
    except Exception as exc:
        msg = str(exc)
        if is_missing_suggestions_table_error(msg): raise HTTPException(status_code=500, detail=MISSING_TABLE_MSG)
        raise HTTPException(status_code=500, detail=f"Falha ao listar sugestoes: {msg}")
    return [{**dict(item), "status": normalize_suggestion_status(item.get("status"))} for item in suggestions]

@router.patch("/api/gestor/sugestoes/{sugestao_id}/status")
async def manager_update_suggestion_status(sugestao_id: int, req: SuggestionStatusUpdateRequest, authorization: Optional[str] = Header(default=None)):
    manager_payload = require_manager_auth(authorization)
    new_status = coerce_suggestion_status(req.status)
    if new_status not in SUGGESTION_STATUS_SET:
        raise HTTPException(status_code=400, detail="Status invalido. Utilize: " + ", ".join(SUGGESTION_STATUS_FLOW))
    manager_identity = get_admin_identity(int(manager_payload.get("user_id")))
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    try:
        existing = supabase.table("sugestoes_melhoria").select("id,cancelada").eq("id", sugestao_id).limit(1).execute().data or []
        if not existing: raise HTTPException(status_code=404, detail="Sugestao nao encontrada")
        if bool(existing[0].get("cancelada")): raise HTTPException(status_code=409, detail="Sugestao cancelada nao pode ter status alterado")
        supabase.table("sugestoes_melhoria").update({"status": new_status, "updated_at": now_iso, "status_updated_at": now_iso, "status_updated_by_admin_id": int(manager_identity.get("id") or 0), "status_updated_by_admin_nome": manager_identity.get("username") or manager_identity.get("email") or "Admin"}).eq("id", sugestao_id).execute()
        updated = supabase.table("sugestoes_melhoria").select("*").eq("id", sugestao_id).limit(1).execute().data or []
    except HTTPException: raise
    except Exception as exc:
        msg = str(exc)
        if is_missing_suggestions_table_error(msg): raise HTTPException(status_code=500, detail=MISSING_TABLE_MSG)
        if is_missing_suggestions_column_error(msg, "cancelada"): raise HTTPException(status_code=500, detail=MISSING_SCHEMA_MSG)
        raise HTTPException(status_code=500, detail=f"Falha ao atualizar status: {msg}")
    item = dict(updated[0]) if updated else {"id": sugestao_id, "status": new_status, "updated_at": now_iso}
    item["status"] = normalize_suggestion_status(item.get("status"))
    return {"status": "ok", "sugestao": item}

@router.patch("/api/gestor/sugestoes/{sugestao_id}/resposta")
async def manager_respond_suggestion(sugestao_id: int, req: SuggestionAdminResponseRequest, authorization: Optional[str] = Header(default=None)):
    manager_payload = require_manager_auth(authorization)
    resposta = (req.resposta or "").strip()
    if not resposta: raise HTTPException(status_code=400, detail="Resposta e obrigatoria")
    if len(resposta) > 3000: raise HTTPException(status_code=400, detail="Resposta deve ter no maximo 3000 caracteres")
    manager_identity = get_admin_identity(int(manager_payload.get("user_id")))
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    try:
        existing = supabase.table("sugestoes_melhoria").select("id,cancelada").eq("id", sugestao_id).limit(1).execute().data or []
        if not existing: raise HTTPException(status_code=404, detail="Sugestao nao encontrada")
        if bool(existing[0].get("cancelada")): raise HTTPException(status_code=409, detail="Sugestao cancelada nao pode receber resposta")
        supabase.table("sugestoes_melhoria").update({"resposta_admin": resposta, "resposta_admin_at": now_iso, "resposta_admin_por_admin_id": int(manager_identity.get("id") or 0), "resposta_admin_por_admin_nome": manager_identity.get("username") or manager_identity.get("email") or "Admin", "updated_at": now_iso}).eq("id", sugestao_id).execute()
        updated = supabase.table("sugestoes_melhoria").select("*").eq("id", sugestao_id).limit(1).execute().data or []
    except HTTPException: raise
    except Exception as exc:
        msg = str(exc)
        if is_missing_suggestions_table_error(msg): raise HTTPException(status_code=500, detail=MISSING_TABLE_MSG)
        if any(is_missing_suggestions_column_error(msg, c) for c in ("resposta_admin", "resposta_admin_at", "resposta_admin_por_admin_id", "resposta_admin_por_admin_nome", "cancelada")): raise HTTPException(status_code=500, detail=MISSING_SCHEMA_MSG)
        raise HTTPException(status_code=500, detail=f"Falha ao registrar resposta: {msg}")
    item = dict(updated[0]) if updated else {"id": sugestao_id, "resposta_admin": resposta, "resposta_admin_at": now_iso}
    item["status"] = normalize_suggestion_status(item.get("status"))
    return {"status": "ok", "sugestao": item}