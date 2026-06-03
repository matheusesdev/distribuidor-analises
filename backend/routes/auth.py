import datetime
from typing import Optional
from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from app_core.config import ANALYST_TOKEN_TTL_SECONDS
from app_core.db import supabase
from app_core.limiter import limiter
from domain.analysts import ensure_analyst_online_on_login, validate_analyst_password
from domain.models import ForgotPasswordRequest, LoginEmailRequest, LoginRequest, ResetPasswordRequest
from email_service import generate_reset_token, send_reset_email
from security.passwords import evaluate_password_strength, hash_password
from security.sessions import bump_session_version, serialize_analyst_session
import hashlib

router = APIRouter()

@router.post("/api/login")
@limiter.limit("10/minute")
async def login(request: Request, req: LoginRequest):
    try:
        res = supabase.table("analistas").select("id,nome,email,senha,permissoes,status,is_online,total_hoje,ultima_atribuicao,session_version").eq("id", req.analista_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Credenciais invalidas")
        analista = res.data[0]
        if analista.get("status") == "inativo":
            raise HTTPException(status_code=403, detail="Conta desativada. Entre em contato com o administrador.")
        if not validate_analyst_password(req.analista_id, (req.senha or "").strip(), str(analista.get("senha") or "").strip()):
            raise HTTPException(status_code=401, detail="Senha incorreta")
        analista = ensure_analyst_online_on_login(analista)
        session_data = serialize_analyst_session(analista)
        token = session_data.pop("token", None)
        resp = JSONResponse(content=session_data)
        if token:
            resp.set_cookie("analystToken", token, httponly=True, secure=False, samesite="lax", max_age=ANALYST_TOKEN_TTL_SECONDS)
        return resp
    except HTTPException: raise
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/login/email")
@limiter.limit("10/minute")
async def login_email(request: Request, req: LoginEmailRequest):
    email = (req.email or "").strip().lower()
    senha = (req.senha or "").strip()
    if not email or not senha:
        raise HTTPException(status_code=400, detail="E-mail e senha sao obrigatorios")
    try:
        res = supabase.table("analistas").select("id,nome,email,senha,permissoes,status,is_online,total_hoje,ultima_atribuicao,session_version").eq("email", email).execute()
        if not res.data:
            raise HTTPException(status_code=401, detail="E-mail ou senha incorretos")
        analista = res.data[0]
        if analista.get("status") == "inativo":
            raise HTTPException(status_code=403, detail="Conta desativada. Entre em contato com o administrador.")
        if not validate_analyst_password(analista["id"], senha, str(analista.get("senha") or "").strip()):
            raise HTTPException(status_code=401, detail="E-mail ou senha incorretos")
        analista = ensure_analyst_online_on_login(analista)
        session_data = serialize_analyst_session(analista)
        token = session_data.pop("token", None)
        resp = JSONResponse(content=session_data)
        if token:
            resp.set_cookie("analystToken", token, httponly=True, secure=False, samesite="lax", max_age=ANALYST_TOKEN_TTL_SECONDS)
        return resp
    except HTTPException: raise
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/logout")
async def analyst_logout():
    resp = JSONResponse(content={"status": "ok"})
    resp.delete_cookie("analystToken", httponly=True, samesite="lax")
    return resp

@router.post("/api/analista/esqueceu-senha")
async def forgot_password(req: ForgotPasswordRequest):
    email = (req.email or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Informe o e-mail")
    RESPOSTA_PADRAO = {"status": "ok", "message": "Se o e-mail estiver cadastrado, voce recebera as instrucoes em breve."}
    try:
        from app_core.config import FRONTEND_URL, RESET_TOKEN_TTL_MINUTES
        res = supabase.table("analistas").select("id,nome,email,status").eq("email", email).execute()
        if not res.data or res.data[0].get("status") == "inativo":
            return RESPOSTA_PADRAO
        analista = res.data[0]
        plain_token, token_hash = generate_reset_token()
        expires_at = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=RESET_TOKEN_TTL_MINUTES)).isoformat()
        supabase.table("analistas").update({"reset_token_hash": token_hash, "reset_token_expires": expires_at}).eq("id", analista["id"]).execute()
        reset_link = f"{FRONTEND_URL}?reset_token={plain_token}"
        email_sent = send_reset_email(to_email=analista["email"], reset_link=reset_link, analyst_name=analista.get("nome", "Analista"))
        if not email_sent:
            supabase.table("analistas").update({"reset_token_hash": None, "reset_token_expires": None}).eq("id", analista["id"]).execute()
        return RESPOSTA_PADRAO
    except HTTPException: raise
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/analista/resetar-senha")
async def reset_password(req: ResetPasswordRequest):
    plain_token = (req.token or "").strip()
    nova_senha = (req.nova_senha or "").strip()
    if not plain_token or not nova_senha:
        raise HTTPException(status_code=400, detail="Token e nova senha sao obrigatorios")
    strength = evaluate_password_strength(nova_senha)
    if not strength["is_acceptable"]:
        raise HTTPException(status_code=400, detail="A senha esta fraca. Use pelo menos 8 caracteres com letras, numeros e simbolos.")
    token_hash = hashlib.sha256(plain_token.encode("utf-8")).hexdigest()
    now = datetime.datetime.now(datetime.timezone.utc)
    try:
        res = supabase.table("analistas").select("id,reset_token_hash,reset_token_expires").eq("reset_token_hash", token_hash).execute()
        if not res.data:
            raise HTTPException(status_code=400, detail="Token invalido ou ja utilizado")
        analista = res.data[0]
        expires_str = (analista.get("reset_token_expires") or "").strip()
        if not expires_str:
            raise HTTPException(status_code=400, detail="Token invalido")
        expires_at = datetime.datetime.fromisoformat(expires_str.replace("Z", "+00:00"))
        if now > expires_at:
            raise HTTPException(status_code=400, detail="Token expirado. Solicite um novo link de redefinicao.")
        supabase.table("analistas").update({"senha": hash_password(nova_senha), "reset_token_hash": None, "reset_token_expires": None}).eq("id", analista["id"]).execute()
        bump_session_version("analyst", int(analista["id"]))
        return {"status": "ok", "message": "Senha redefinida com sucesso. Faca login com sua nova senha."}
    except HTTPException: raise
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))