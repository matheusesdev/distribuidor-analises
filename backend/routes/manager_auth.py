from typing import Optional
from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from postgrest.exceptions import APIError
from app_core.config import MANAGER_TOKEN_TTL_SECONDS
from app_core.db import supabase
from app_core.limiter import limiter
from domain.models import AdminCreateRequest, ManagerLoginRequest, SessionRevokeRequest
from security.passwords import evaluate_password_strength, hash_password
from security.sessions import bump_session_version, ensure_unique_admin_username, get_admin_identity, record_session_revoke_audit, serialize_admin_list_item, serialize_admin_session, username_from_email, verify_admin_credentials
from security.deps import require_manager_auth

router = APIRouter()

@router.post("/api/gestor/login")
@limiter.limit("5/minute")
async def manager_login(request: Request, req: ManagerLoginRequest):
    admin = verify_admin_credentials(req.usuario, req.senha)
    if not admin:
        raise HTTPException(status_code=401, detail="Usuario ou senha do admin invalidos")
    session_data = serialize_admin_session(admin)
    token = session_data.pop("token", None)
    resp = JSONResponse(content=session_data)
    if token:
        resp.set_cookie("managerToken", token, httponly=True, secure=False, samesite="lax", max_age=MANAGER_TOKEN_TTL_SECONDS)
    return resp

@router.post("/api/gestor/logout")
async def manager_logout():
    resp = JSONResponse(content={"status": "ok"})
    resp.delete_cookie("managerToken", httponly=True, samesite="lax")
    return resp

@router.get("/api/gestor/admins")
async def list_admin_users(authorization: Optional[str] = Header(default=None)):
    require_manager_auth(authorization)
    try:
        res = supabase.table("administradores").select("id,username,email,ativo,data_criacao,updated_at").order("data_criacao", desc=True).execute()
        return [serialize_admin_list_item(item) for item in (res.data or [])]
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/gestor/admins")
async def create_admin_user(req: AdminCreateRequest, authorization: Optional[str] = Header(default=None)):
    require_manager_auth(authorization)
    email = (req.email or "").strip().lower()
    senha = (req.senha or "").strip()
    username_input = (req.username or "").strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Informe um e-mail valido")
    if not senha:
        raise HTTPException(status_code=400, detail="Senha e obrigatoria")
    strength = evaluate_password_strength(senha)
    if not strength["is_acceptable"]:
        raise HTTPException(status_code=400, detail=f"Senha fraca: {strength['label']}")
    try:
        if supabase.table("administradores").select("id").eq("email", email).limit(1).execute().data:
            raise HTTPException(status_code=409, detail="Ja existe administrador com este e-mail")
        base_username = username_input or username_from_email(email)
        username = ensure_unique_admin_username(base_username)
        insert_payload = {"username": username, "email": email, "senha": hash_password(senha), "ativo": bool(req.ativo), "session_version": 1}
        try:
            created = supabase.table("administradores").insert(insert_payload).execute().data or []
        except Exception as insert_exc:
            if "session_version" in str(insert_exc):
                insert_payload.pop("session_version", None)
                created = supabase.table("administradores").insert(insert_payload).execute().data or []
            else: raise
        if not created:
            raise HTTPException(status_code=500, detail="Falha ao criar administrador")
        row = created[0]
        return {"id": row.get("id"), "username": row.get("username"), "email": row.get("email"), "ativo": row.get("ativo", True), "data_criacao": row.get("data_criacao")}
    except HTTPException: raise
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/gestor/sessoes/revogar")
async def revoke_user_sessions(req: SessionRevokeRequest, authorization: Optional[str] = Header(default=None)):
    actor_payload = require_manager_auth(authorization)
    actor = get_admin_identity(int(actor_payload.get("user_id") or 0))
    role = (req.role or "").strip().lower()
    if role not in {"admin", "analyst"}:
        raise HTTPException(status_code=400, detail="Role invalida. Use 'admin' ou 'analyst'.")
    user_id = int(req.user_id)
    next_version = bump_session_version(role, user_id)
    record_session_revoke_audit(actor=actor, role=role, user_id=user_id, reason=req.reason or "manual", session_version=next_version)
    return {"status": "ok", "role": role, "user_id": user_id, "session_version": next_version, "redistribuidas": 0, "sem_destino": 0, "reason": (req.reason or "manual").strip() or "manual"}