import datetime
from typing import Any, Dict, Optional
from fastapi import HTTPException
from app_core.db import supabase
from app_core.logging_setup import logger
from security.passwords import hash_password, verify_password
from security.tokens import create_analyst_token, create_manager_token

def verify_admin_credentials(identifier, password):
    nid = (identifier or "").strip().lower()
    npw = (password or "").strip()
    if not nid or not npw: return None
    try:
        admin = None
        if "@" in nid:
            r = supabase.table("administradores").select("*").eq("email", nid).limit(1).execute()
            if r.data: admin = r.data[0]
        if not admin:
            r = supabase.table("administradores").select("*").eq("username", nid).limit(1).execute()
            if r.data: admin = r.data[0]
        if not admin or not admin.get("ativo", True): return None
        return admin if verify_password(npw, str(admin.get("senha") or "")) else None
    except Exception as e:
        logger.error("Erro ao verificar credenciais do admin: %s", e)
        return None

def username_from_email(email):
    local = (email or "").strip().lower().split("@", 1)[0]
    safe = "".join(c if (c.isalnum() or c in "._-") else "_" for c in local).strip("._-")
    return (safe or "admin")[:32]

def ensure_unique_admin_username(base_username):
    candidate = (base_username or "admin").strip().lower() or "admin"
    for suffix in range(10000):
        current = candidate if suffix == 0 else f"{candidate}{suffix}"
        if not supabase.table("administradores").select("id").eq("username", current).limit(1).execute().data:
            return current
    raise RuntimeError("Nao foi possivel gerar username unico")

def serialize_admin_session(admin):
    return {"id": admin.get("id"), "usuario": admin.get("username"), "email": admin.get("email"), "token": create_manager_token(admin)}

def serialize_admin_list_item(admin):
    return {"id": admin.get("id"), "username": admin.get("username"), "email": admin.get("email"), "ativo": bool(admin.get("ativo", True)), "data_criacao": admin.get("data_criacao"), "updated_at": admin.get("updated_at")}

def serialize_analyst_session(analyst):
    return {"id": analyst.get("id"), "nome": analyst.get("nome"), "email": analyst.get("email"), "permissoes": [int(i) for i in (analyst.get("permissoes") or []) if i is not None], "status": analyst.get("status") or "ativo", "is_online": bool(analyst.get("is_online")), "total_hoje": int(analyst.get("total_hoje") or 0), "ultima_atribuicao": analyst.get("ultima_atribuicao"), "token": create_analyst_token(analyst)}

def serialize_analyst_public(analyst):
    return {"id": analyst.get("id"), "nome": analyst.get("nome"), "email": analyst.get("email"), "permissoes": [int(i) for i in (analyst.get("permissoes") or []) if i is not None], "status": analyst.get("status") or "ativo", "is_online": bool(analyst.get("is_online")), "total_hoje": int(analyst.get("total_hoje") or 0), "na_mesa": int(analyst.get("na_mesa") or 0), "ultima_atribuicao": analyst.get("ultima_atribuicao")}

def bump_session_version(role, user_id):
    table = "administradores" if role == "admin" else "analistas"
    try:
        row = supabase.table(table).select("id,session_version").eq("id", user_id).limit(1).execute().data or []
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Revogacao remota indisponivel. Detalhe: {exc}")
    if not row: raise HTTPException(status_code=404, detail="Usuario nao encontrado")
    next_v = int(row[0].get("session_version") or 1) + 1
    try:
        supabase.table(table).update({"session_version": next_v}).eq("id", user_id).execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Nao foi possivel revogar sessao. Detalhe: {exc}")
    return next_v

def get_admin_identity(admin_id):
    try:
        row = (supabase.table("administradores").select("id,username,email").eq("id", int(admin_id)).limit(1).execute().data or [None])[0] or {}
        return {"id": int(row.get("id") or admin_id), "username": row.get("username"), "email": row.get("email")}
    except: return {"id": int(admin_id), "username": None, "email": None}

def get_target_identity(role, user_id):
    table = "administradores" if role == "admin" else "analistas"
    fields = "id,username,email" if role == "admin" else "id,nome,email"
    try:
        row = (supabase.table(table).select(fields).eq("id", int(user_id)).limit(1).execute().data or [None])[0] or {}
        return {"id": int(row.get("id") or user_id), "name": row.get("username") if role == "admin" else row.get("nome"), "email": row.get("email")}
    except: return {"id": int(user_id), "name": None, "email": None}

def record_session_revoke_audit(*, actor, role, user_id, reason, session_version):
    ts = datetime.datetime.now(datetime.timezone.utc).isoformat()
    target = get_target_identity(role, user_id)
    payload = {"actor_admin_id": int(actor.get("id") or 0), "actor_admin_username": actor.get("username"), "actor_admin_email": actor.get("email"), "target_role": role, "target_user_id": int(target.get("id") or user_id), "target_user_name": target.get("name"), "target_user_email": target.get("email"), "reason": (reason or "manual").strip() or "manual", "new_session_version": int(session_version), "revoked_at": ts}
    try:
        supabase.table("logs_sessoes_revogadas").insert(payload).execute()
    except Exception as exc:
        logger.error("[AUDIT] Falha ao registrar logs_sessoes_revogadas: %s | payload=%s", exc, payload)