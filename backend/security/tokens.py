import base64, binascii, datetime, hashlib, hmac, os
from typing import Any, Dict, Optional
from app_core.config import ADMIN_AUTH_SECRET, ANALYST_AUTH_SECRET, ANALYST_TOKEN_TTL_SECONDS, MANAGER_TOKEN_TTL_SECONDS
from app_core.db import supabase

def get_admin_session_version(admin):
    try: return int(admin.get("session_version") or 1)
    except: return 1

def get_analyst_session_version(analyst):
    try: return int(analyst.get("session_version") or 1)
    except: return 1

def create_signed_session_token(role, user_id, session_version, ttl_seconds, secret):
    issued_at = str(int(datetime.datetime.now(datetime.timezone.utc).timestamp()))
    nonce = os.urandom(8).hex()
    payload = f"{role}:{int(user_id)}:{int(session_version)}:{issued_at}:{nonce}:{int(ttl_seconds)}"
    sig = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return base64.urlsafe_b64encode(f"{payload}:{sig}".encode()).decode().rstrip("=")

def decode_signed_session_token(token, secret):
    t = (token or "").strip()
    if not t: return None
    try:
        padding = "=" * (-len(t) % 4)
        decoded = base64.urlsafe_b64decode(f"{t}{padding}".encode()).decode()
        role, user_id, sv, issued_at, nonce, ttl, sig = decoded.split(":", 6)
    except (ValueError, binascii.Error, UnicodeDecodeError):
        return None
    payload = f"{role}:{user_id}:{sv}:{issued_at}:{nonce}:{ttl}"
    if not hmac.compare_digest(sig, hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()):
        return None
    try:
        uid, version, iat, ttl_s = int(user_id), int(sv), int(issued_at), int(ttl)
    except ValueError:
        return None
    if int(datetime.datetime.now(datetime.timezone.utc).timestamp()) - iat > ttl_s:
        return None
    return {"role": role, "user_id": uid, "session_version": version, "issued_at": iat, "ttl_seconds": ttl_s}

def create_manager_token(admin):
    return create_signed_session_token("admin", int(admin["id"]), get_admin_session_version(admin), MANAGER_TOKEN_TTL_SECONDS, ADMIN_AUTH_SECRET)

def create_analyst_token(analyst):
    return create_signed_session_token("analyst", int(analyst["id"]), get_analyst_session_version(analyst), ANALYST_TOKEN_TTL_SECONDS, ANALYST_AUTH_SECRET)

def verify_manager_token(token):
    payload = decode_signed_session_token(token, ADMIN_AUTH_SECRET)
    if not payload or payload.get("role") != "admin": return None
    try:
        res = supabase.table("administradores").select("*").eq("id", payload["user_id"]).limit(1).execute()
        if not res.data: return None
        admin = res.data[0]
        if not admin.get("ativo", True): return None
        if int(admin.get("session_version") or 1) != int(payload["session_version"]): return None
        return payload
    except: return None

def verify_analyst_token(token):
    payload = decode_signed_session_token(token, ANALYST_AUTH_SECRET)
    if not payload or payload.get("role") != "analyst": return None
    try:
        res = supabase.table("analistas").select("*").eq("id", payload["user_id"]).limit(1).execute()
        if not res.data: return None
        a = res.data[0]
        if (a.get("status") or "ativo") == "inativo": return None
        if int(a.get("session_version") or 1) != int(payload["session_version"]): return None
        return payload
    except: return None