from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import requests
import datetime
import asyncio
import os
import base64
import binascii
import hashlib
import hmac
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from supabase import create_client, Client
from pydantic import BaseModel
from postgrest.exceptions import APIError


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


def parse_bool_env(name: str, default: bool = False) -> bool:
    raw_value = (os.getenv(name) or "").strip().lower()
    if not raw_value:
        return default
    return raw_value in {"1", "true", "yes", "on", "y", "sim"}


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


def evaluate_password_strength(password: str) -> Dict[str, Any]:
    normalized_password = (password or "").strip()
    checks = [
        len(normalized_password) >= 8,
        len(normalized_password) >= 12,
        any(char.islower() for char in normalized_password) and any(char.isupper() for char in normalized_password),
        any(char.isdigit() for char in normalized_password),
        any(not char.isalnum() for char in normalized_password),
    ]
    score = sum(1 for passed in checks if passed)

    if score <= 2:
        return {"level": "weak", "label": "Muito fraca", "is_acceptable": False}
    if score == 3:
        return {"level": "medium", "label": "Média", "is_acceptable": True}
    if score == 4:
        return {"level": "strong", "label": "Forte", "is_acceptable": True}
    return {"level": "verystrong", "label": "Muito forte", "is_acceptable": True}


def verify_admin_credentials(identifier: str, password: str) -> Optional[Dict[str, Any]]:
    """
    Verifica credenciais do admin consultando a tabela administradores no Supabase.
    Retorna os dados do admin se válido, None caso contrário.
    """
    normalized_identifier = (identifier or "").strip().lower()
    normalized_password = (password or "").strip()

    if not normalized_identifier or not normalized_password:
        return None

    try:
        admin = None

        if "@" in normalized_identifier:
            by_email = (
                supabase.table("administradores")
                .select("*")
                .eq("email", normalized_identifier)
                .limit(1)
                .execute()
            )
            if by_email.data:
                admin = by_email.data[0]

        if not admin:
            by_username = (
                supabase.table("administradores")
                .select("*")
                .eq("username", normalized_identifier)
                .limit(1)
                .execute()
            )
            if by_username.data:
                admin = by_username.data[0]

        if not admin:
            return None
        
        # Verifica se está ativo
        if not admin.get("ativo", True):
            return None

        # Verifica a senha (sempre armazenada em hash no banco)
        if verify_password(normalized_password, str(admin.get("senha") or "")):
            return admin
        
        return None
    except Exception as e:
        print(f"Erro ao verificar credenciais do admin: {e}")
        return None


def username_from_email(email: str) -> str:
    normalized_email = (email or "").strip().lower()
    local_part = normalized_email.split("@", 1)[0]
    safe = "".join(char if (char.isalnum() or char in "._-") else "_" for char in local_part).strip("._-")
    if not safe:
        safe = "admin"
    return safe[:32]


def ensure_unique_admin_username(base_username: str) -> str:
    candidate = (base_username or "admin").strip().lower()
    if not candidate:
        candidate = "admin"

    for suffix in range(0, 10000):
        current = candidate if suffix == 0 else f"{candidate}{suffix}"
        existing = (
            supabase.table("administradores")
            .select("id")
            .eq("username", current)
            .limit(1)
            .execute()
        )
        if not existing.data:
            return current

    raise RuntimeError("Não foi possível gerar username único para o novo admin")


def create_signed_session_token(role: str, user_id: int, session_version: int, ttl_seconds: int, secret: str) -> str:
    issued_at = str(int(datetime.datetime.now(datetime.timezone.utc).timestamp()))
    nonce = os.urandom(8).hex()
    payload = f"{role}:{int(user_id)}:{int(session_version)}:{issued_at}:{nonce}:{int(ttl_seconds)}"
    signature = hmac.new(secret.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    raw_token = f"{payload}:{signature}"
    return base64.urlsafe_b64encode(raw_token.encode("utf-8")).decode("ascii").rstrip("=")


def decode_signed_session_token(token: str, secret: str) -> Optional[Dict[str, Any]]:
    normalized_token = (token or "").strip()
    if not normalized_token:
        return None

    padding = "=" * (-len(normalized_token) % 4)
    try:
        decoded = base64.urlsafe_b64decode(f"{normalized_token}{padding}".encode("ascii")).decode("utf-8")
        role, user_id, session_version, issued_at, nonce, ttl_seconds, signature = decoded.split(":", 6)
    except (ValueError, binascii.Error, UnicodeDecodeError):
        return None

    payload = f"{role}:{user_id}:{session_version}:{issued_at}:{nonce}:{ttl_seconds}"
    expected_signature = hmac.new(secret.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected_signature):
        return None

    try:
        user_id_int = int(user_id)
        version_int = int(session_version)
        issued_at_ts = int(issued_at)
        ttl_seconds_int = int(ttl_seconds)
    except ValueError:
        return None

    now_ts = int(datetime.datetime.now(datetime.timezone.utc).timestamp())
    if now_ts - issued_at_ts > ttl_seconds_int:
        return None

    return {
        "role": role,
        "user_id": user_id_int,
        "session_version": version_int,
        "issued_at": issued_at_ts,
        "ttl_seconds": ttl_seconds_int,
    }


def get_admin_session_version(admin: Dict[str, Any]) -> int:
    try:
        return int(admin.get("session_version") or 1)
    except Exception:
        return 1


def get_analyst_session_version(analyst: Dict[str, Any]) -> int:
    try:
        return int(analyst.get("session_version") or 1)
    except Exception:
        return 1


def create_manager_token(admin: Dict[str, Any]) -> str:
    return create_signed_session_token(
        role="admin",
        user_id=int(admin.get("id")),
        session_version=get_admin_session_version(admin),
        ttl_seconds=MANAGER_TOKEN_TTL_SECONDS,
        secret=ADMIN_AUTH_SECRET,
    )


def create_analyst_token(analyst: Dict[str, Any]) -> str:
    return create_signed_session_token(
        role="analyst",
        user_id=int(analyst.get("id")),
        session_version=get_analyst_session_version(analyst),
        ttl_seconds=ANALYST_TOKEN_TTL_SECONDS,
        secret=ANALYST_AUTH_SECRET,
    )


def verify_manager_token(token: str) -> Optional[Dict[str, Any]]:
    payload = decode_signed_session_token(token, ADMIN_AUTH_SECRET)
    if not payload or payload.get("role") != "admin":
        return None

    try:
        res = (
            supabase.table("administradores")
            .select("*")
            .eq("id", payload["user_id"])
            .limit(1)
            .execute()
        )
        if not res.data:
            return None
        admin = res.data[0]
        if not admin.get("ativo", True):
            return None
        session_version = int(admin.get("session_version") or 1)
        if session_version != int(payload["session_version"]):
            return None
        return payload
    except Exception:
        return None


def verify_analyst_token(token: str) -> Optional[Dict[str, Any]]:
    payload = decode_signed_session_token(token, ANALYST_AUTH_SECRET)
    if not payload or payload.get("role") != "analyst":
        return None

    try:
        res = (
            supabase.table("analistas")
            .select("*")
            .eq("id", payload["user_id"])
            .limit(1)
            .execute()
        )
        if not res.data:
            return None
        analyst = res.data[0]
        if (analyst.get("status") or "ativo") == "inativo":
            return None
        session_version = int(analyst.get("session_version") or 1)
        if session_version != int(payload["session_version"]):
            return None
        return payload
    except Exception:
        return None


def require_manager_auth(authorization: Optional[str]) -> Dict[str, Any]:
    if not authorization:
        raise HTTPException(status_code=401, detail="Acesso restrito. Faça login no painel admin.")

    scheme, _, token = authorization.partition(" ")
    payload = verify_manager_token(token) if scheme.lower() == "bearer" else None
    if not payload:
        raise HTTPException(status_code=401, detail="Sessão do admin inválida ou expirada.")
    return payload


def require_analyst_auth(authorization: Optional[str], expected_analyst_id: Optional[int] = None) -> Dict[str, Any]:
    if not authorization:
        raise HTTPException(status_code=401, detail="Sessão do analista ausente. Faça login novamente.")

    scheme, _, token = authorization.partition(" ")
    payload = verify_analyst_token(token) if scheme.lower() == "bearer" else None
    if not payload:
        raise HTTPException(status_code=401, detail="Sessão do analista inválida ou expirada.")

    if expected_analyst_id is not None and int(payload.get("user_id")) != int(expected_analyst_id):
        raise HTTPException(status_code=403, detail="Token do analista não autorizado para este usuário.")

    return payload


def require_authenticated_user(authorization: Optional[str]) -> Dict[str, Any]:
    if not authorization:
        raise HTTPException(status_code=401, detail="Autenticação obrigatória.")

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="Token de autenticação inválido.")

    manager_payload = verify_manager_token(token)
    if manager_payload:
        return manager_payload

    analyst_payload = verify_analyst_token(token)
    if analyst_payload:
        return analyst_payload

    raise HTTPException(status_code=401, detail="Sessão inválida ou expirada.")


def bump_session_version(role: str, user_id: int) -> int:
    table_name = "administradores" if role == "admin" else "analistas"

    try:
        row = (
            supabase.table(table_name)
            .select("id,session_version")
            .eq("id", user_id)
            .limit(1)
            .execute()
            .data
            or []
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "Revogação remota indisponível: coluna session_version ausente. "
                "Execute a migration 005_session_version_security.sql. "
                f"Detalhe: {exc}"
            ),
        )

    if not row:
        raise HTTPException(status_code=404, detail="Usuário não encontrado para revogação")

    current_version = int(row[0].get("session_version") or 1)
    next_version = current_version + 1

    try:
        supabase.table(table_name).update({"session_version": next_version}).eq("id", user_id).execute()
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "Não foi possível revogar sessão remotamente. "
                "Confirme a migration de session_version em analistas/administradores. "
                f"Detalhe: {exc}"
            ),
        )

    return next_version


def generate_reset_token() -> tuple:
    """Gera (plain_token, token_hash). Armazena apenas o hash, envia o plain."""
    raw = os.urandom(32)
    plain = base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")
    token_hash = hashlib.sha256(plain.encode("utf-8")).hexdigest()
    return plain, token_hash


def send_reset_email(to_email: str, reset_link: str, analyst_name: str) -> bool:
    """Envia e-mail de redefinição de senha via SMTP configurado nas env vars."""
    if not SMTP_HOST or not SMTP_FROM:
        print(f"[AVISO] SMTP não configurado. Link de reset para {to_email}: {reset_link}")
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Redefinição de senha — VCACloud"
        msg["From"] = SMTP_FROM
        msg["To"] = to_email

        text_body = (
            f"Olá, {analyst_name}!\n\n"
            f"Recebemos uma solicitação de redefinição de senha para sua conta no VCACloud.\n\n"
            f"Clique no link abaixo (válido por {RESET_TOKEN_TTL_MINUTES} minutos):\n{reset_link}\n\n"
            f"Se você não solicitou, desconsidere este e-mail.\n\nVCA Construtora"
        )

        year = datetime.datetime.now().year
        html_body = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f8fafc;margin:0;padding:24px;">
  <div style="max-width:480px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">
    <div style="background:#2563eb;padding:32px;text-align:center;">
      <p style="color:white;font-size:22px;font-weight:900;margin:0;letter-spacing:-0.5px;">VCACloud</p>
    </div>
    <div style="padding:32px;">
      <p style="color:#1e293b;font-size:16px;font-weight:700;margin:0 0 8px;">Olá, {analyst_name}!</p>
      <p style="color:#64748b;font-size:14px;margin:0 0 24px;">
        Recebemos uma solicitação de redefinição de senha para sua conta no <strong>VCACloud</strong>.
      </p>
      <a href="{reset_link}"
         style="display:block;background:#2563eb;color:white;text-align:center;padding:14px 24px;border-radius:12px;font-weight:900;font-size:13px;text-decoration:none;letter-spacing:1px;text-transform:uppercase;">
        Redefinir minha senha
      </a>
      <p style="color:#94a3b8;font-size:11px;margin:20px 0 0;text-align:center;">
        Link válido por {RESET_TOKEN_TTL_MINUTES} minutos.<br>
        Se não foi você, desconsidere este e-mail.
      </p>
    </div>
    <div style="background:#f1f5f9;padding:16px 32px;text-align:center;">
      <p style="color:#94a3b8;font-size:11px;margin:0;">VCA Construtora © {year}</p>
    </div>
  </div>
</body></html>"""

        msg.attach(MIMEText(text_body, "plain", "utf-8"))
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        smtp_client = smtplib.SMTP_SSL if SMTP_USE_SSL else smtplib.SMTP
        with smtp_client(SMTP_HOST, SMTP_PORT, timeout=SMTP_TIMEOUT_SECONDS) as server:
            server.ehlo()
            if SMTP_USE_TLS and not SMTP_USE_SSL:
                server.starttls()
                server.ehlo()
            if SMTP_USER and SMTP_PASS:
                server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_FROM, [to_email], msg.as_string())
        return True
    except Exception as e:
        print(f"[ERRO] Falha ao enviar e-mail de reset: {e}")
        return False


def validate_analyst_password(analyst_id: int, received_password: str, stored_password: str) -> bool:
    normalized_received_password = (received_password or "").strip()
    normalized_stored_password = (stored_password or "").strip()

    password_is_valid = verify_password(normalized_received_password, normalized_stored_password)
    if not password_is_valid and normalized_received_password == normalized_stored_password:
        new_password_hash = hash_password(normalized_received_password)
        supabase.table("analistas").update({"senha": new_password_hash}).eq("id", analyst_id).execute()
        password_is_valid = True

    return password_is_valid


def is_missing_transfer_logs_table_error(error_message: str) -> bool:
    return (
        "logs_transferencias" in error_message
        and (
            "does not exist" in error_message
            or "42P01" in error_message
            or "PGRST205" in error_message
            or "schema cache" in error_message
        )
    )


def build_transfer_log_payload(
    *,
    reserva_id: Any,
    origem: Dict[str, Any],
    destino: Dict[str, Any],
    pasta: Dict[str, Any],
    situacao_id: int,
    motivo: str,
    data_transferencia: str,
) -> Dict[str, Any]:
    return {
        "reserva_id": str(reserva_id),
        "analista_origem_id": int(origem.get("id")),
        "analista_origem_nome": origem.get("nome"),
        "analista_destino_id": int(destino.get("id")),
        "analista_destino_nome": destino.get("nome"),
        "situacao_id": situacao_id,
        "situacao_nome": pasta.get("situacao_nome") or SITUACOES_NOMES.get(situacao_id, "Geral"),
        "cliente": pasta.get("cliente"),
        "empreendimento": pasta.get("empreendimento"),
        "unidade": pasta.get("unidade"),
        "motivo": motivo,
        "data_transferencia": data_transferencia,
    }


def get_admin_identity(admin_id: int) -> Dict[str, Any]:
    try:
        response = (
            supabase.table("administradores")
            .select("id,username,email")
            .eq("id", int(admin_id))
            .limit(1)
            .execute()
        )
        row = (response.data or [None])[0] or {}
        return {
            "id": int(row.get("id") or admin_id),
            "username": row.get("username"),
            "email": row.get("email"),
        }
    except Exception:
        return {"id": int(admin_id), "username": None, "email": None}


def get_target_identity(role: str, user_id: int) -> Dict[str, Any]:
    table_name = "administradores" if role == "admin" else "analistas"
    select_fields = "id,username,email" if role == "admin" else "id,nome,email"

    try:
        response = (
            supabase.table(table_name)
            .select(select_fields)
            .eq("id", int(user_id))
            .limit(1)
            .execute()
        )
        row = (response.data or [None])[0] or {}
        return {
            "id": int(row.get("id") or user_id),
            "name": row.get("username") if role == "admin" else row.get("nome"),
            "email": row.get("email"),
        }
    except Exception:
        return {"id": int(user_id), "name": None, "email": None}


def record_session_revoke_audit(*, actor: Dict[str, Any], role: str, user_id: int, reason: str, session_version: int) -> None:
    timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
    target = get_target_identity(role, user_id)

    payload = {
        "actor_admin_id": int(actor.get("id") or 0),
        "actor_admin_username": actor.get("username"),
        "actor_admin_email": actor.get("email"),
        "target_role": role,
        "target_user_id": int(target.get("id") or user_id),
        "target_user_name": target.get("name"),
        "target_user_email": target.get("email"),
        "reason": (reason or "manual").strip() or "manual",
        "new_session_version": int(session_version),
        "revoked_at": timestamp,
    }

    try:
        supabase.table("logs_sessoes_revogadas").insert(payload).execute()
    except Exception as exc:
        print(f"[AUDIT] Falha ao registrar logs_sessoes_revogadas: {exc} | payload={payload}")


load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

ALLOWED_ORIGINS = parse_allowed_origins(os.getenv("ALLOWED_ORIGINS", "http://localhost:5173"))
SYNC_INTERVAL_SECONDS = int(os.getenv("SYNC_INTERVAL_SECONDS", "25"))
PORT = int(os.getenv("PORT", "8000"))

SUPABASE_URL = get_required_env("SUPABASE_URL")
SUPABASE_KEY = get_required_env("SUPABASE_KEY")
CVCRM_EMAIL = get_required_env("CVCRM_EMAIL")
CVCRM_TOKEN = get_required_env("CVCRM_TOKEN")
CVCRM_BASE_URL = (os.getenv("CVCRM_BASE_URL") or "https://vca.cvcrm.com.br/api/v1/comercial/reservas").strip()
CVCRM_LOTEAR_BASE_URL = (os.getenv("CVCRM_LOTEAR_BASE_URL") or "https://vcalotear.cvcrm.com.br/api/v1/comercial/reservas").strip()
CVCRM_LOTEAR_TOKEN = (os.getenv("CVCRM_LOTEAR_TOKEN") or "").strip()
ADMIN_AUTH_SECRET = (os.getenv("ADMIN_AUTH_SECRET") or SUPABASE_KEY).strip()
MANAGER_TOKEN_TTL_SECONDS = int(os.getenv("MANAGER_TOKEN_TTL_SECONDS", "1800"))
ANALYST_AUTH_SECRET = (os.getenv("ANALYST_AUTH_SECRET") or ADMIN_AUTH_SECRET).strip()
ANALYST_TOKEN_TTL_SECONDS = int(os.getenv("ANALYST_TOKEN_TTL_SECONDS", "43200"))
APP_TIMEZONE_NAME = (os.getenv("APP_TIMEZONE") or "America/Sao_Paulo").strip() or "America/Sao_Paulo"
try:
    APP_TIMEZONE = ZoneInfo(APP_TIMEZONE_NAME)
except ZoneInfoNotFoundError:
    APP_TIMEZONE = datetime.timezone.utc
    APP_TIMEZONE_NAME = "UTC"

# --- CONFIGURAÇÕES DE E-MAIL PARA RESET DE SENHA ---
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
SMTP_FROM = os.getenv("SMTP_FROM", "") or SMTP_USER
SMTP_USE_TLS = parse_bool_env("SMTP_USE_TLS", default=SMTP_PORT == 587)
SMTP_USE_SSL = parse_bool_env("SMTP_USE_SSL", default=SMTP_PORT == 465)
SMTP_TIMEOUT_SECONDS = int(os.getenv("SMTP_TIMEOUT_SECONDS", "20"))
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://distribuidor-analises.vercel.app")
RESET_TOKEN_TTL_MINUTES = int(os.getenv("RESET_TOKEN_TTL_MINUTES", "60"))

app = FastAPI(title="VCA Distribuidor - Backend Oficial")

# Configuração de CORS para o Frontend
if isinstance(ALLOWED_ORIGINS, list):
    cors_origins = ALLOWED_ORIGINS.copy()
else:
    cors_origins = parse_allowed_origins(str(ALLOWED_ORIGINS))

# Adicionar URL de produção (Vercel) se não estiver já configurada
if "https://distribuidor-analises.vercel.app" not in cors_origins:
    cors_origins.append("https://distribuidor-analises.vercel.app")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- CONFIGURAÇÃO SUPABASE ---
try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("[OK] Conex\u00e3o com Supabase estabelecida.")
except Exception as e:
    print(f"[ERRO] Erro ao ligar ao Supabase: {e}")


def table_supports_column(table_name: str, column_name: str) -> bool:
    try:
        supabase.table(table_name).select(column_name).limit(1).execute()
        return True
    except APIError as exc:
        if exc.args and "42703" in str(exc):
            return False
        raise


HISTORICO_HAS_ANALISTA_NOME = table_supports_column("historico", "analista_nome")
HISTORICO_HAS_SITUACAO_ID = table_supports_column("historico", "situacao_id")
HISTORICO_HAS_SITUACAO_NOME = table_supports_column("historico", "situacao_nome")

# --- MAPEAMENTO DE ORIGENS E SITUAÇÕES DO CVCRM ---
CRM_SOURCES: Dict[str, Dict[str, Any]] = {
    "cvcrm": {
        "name": "CVCRM",
        "api_base_url": CVCRM_BASE_URL,
        "gestor_base_url": "https://vca.cvcrm.com.br/gestor/comercial/reservas",
        "email": CVCRM_EMAIL,
        "token": CVCRM_TOKEN,
        "enabled": True,
    },
    "lotear": {
        "name": "CVCRM LOTEAR",
        "api_base_url": CVCRM_LOTEAR_BASE_URL,
        "gestor_base_url": "https://vcalotear.cvcrm.com.br/gestor/comercial/reservas",
        "email": CVCRM_EMAIL,
        "token": CVCRM_LOTEAR_TOKEN,
        "enabled": bool(CVCRM_LOTEAR_TOKEN),
    },
}

SITUACOES_DEFINITIONS: List[Dict[str, Any]] = [
    {"id": 62, "external_id": 62, "source": "cvcrm", "nome": "ANÁLISE VENDA LOTEAMENTO"},
    {"id": 66, "external_id": 66, "source": "cvcrm", "nome": "ANÁLISE VENDA PARCELAMENTO INCORPORADORA"},
    {"id": 30, "external_id": 30, "source": "cvcrm", "nome": "ANÁLISE VENDA CAIXA"},
    {"id": 16, "external_id": 16, "source": "cvcrm", "nome": "CONFECÇÃO DE CONTRATO"},
    {"id": 31, "external_id": 31, "source": "cvcrm", "nome": "ASSINADO"},
    {"id": 84, "external_id": 84, "source": "cvcrm", "nome": "APROVAÇÃO EXPANSÃO"},
    {"id": 1012, "external_id": 12, "source": "lotear", "nome": "ANÁLISE VENDA LOTEAMENTO (LOTEAR)"},
    {"id": 1023, "external_id": 23, "source": "lotear", "nome": "APROVAÇÃO EXPANSÃO (LOTEAR)"},
    {"id": 1016, "external_id": 16, "source": "lotear", "nome": "CONFECÇÃO DE CONTRATO (LOTEAR)"},
    {"id": 1021, "external_id": 21, "source": "lotear", "nome": "ASSINADO (LOTEAR)"},
]

SITUACOES_NOMES = {item["id"]: item["nome"] for item in SITUACOES_DEFINITIONS}
SITUACOES_IDS = [item["id"] for item in SITUACOES_DEFINITIONS]
SITUACOES_META = {item["id"]: item for item in SITUACOES_DEFINITIONS}

# Estado global do último sync — exposto via /api/gestor/sync-status
_LAST_SYNC_STATE: Dict[str, Any] = {
    "timestamp": None,
    "total_no_crm": 0,
    "por_situacao": {},
    "erros": [],
    "duracao_segundos": None,
}
_SYNC_LOCK = asyncio.Lock()


async def fetch_cvcrm_reservas(sit_id: int, timeout_seconds: int, pagina: int = 1):
    """Executa request ao CRM fora do event loop para evitar bloqueio."""
    meta = SITUACOES_META.get(int(sit_id) if sit_id is not None else -1)
    if not meta:
        raise RuntimeError(f"Situação interna não mapeada: {sit_id}")

    source_key = str(meta.get("source") or "cvcrm")
    source_cfg = CRM_SOURCES.get(source_key)
    if not source_cfg:
        raise RuntimeError(f"Fonte CRM não configurada para situação {sit_id}: {source_key}")
    if not source_cfg.get("enabled"):
        raise RuntimeError(f"Fonte CRM desabilitada para situação {sit_id}: {source_key}")

    external_id = int(meta.get("external_id") or sit_id)
    url = f"{source_cfg['api_base_url']}?situacao={external_id}&pagina={pagina}"
    headers = {
        "email": source_cfg["email"],
        "token": source_cfg["token"],
        "accept": "application/json",
    }
    return await asyncio.to_thread(requests.get, url, headers=headers, timeout=timeout_seconds)


def build_reserva_key(source: str, external_reserva_id: Any) -> str:
    normalized = str(external_reserva_id or "").strip()
    if not normalized:
        return ""
    # Mantém compatibilidade histórica: reservas da fonte padrão continuam sem prefixo.
    if source == "cvcrm":
        return normalized
    return f"{source}:{normalized}"


def parse_reserva_key(reserva_key: Any) -> Dict[str, str]:
    normalized = str(reserva_key or "").strip()
    if not normalized:
        return {"source": "cvcrm", "external_id": ""}

    if ":" in normalized:
        prefix, external = normalized.split(":", 1)
        if prefix in CRM_SOURCES and external:
            return {"source": prefix, "external_id": external}

    return {"source": "cvcrm", "external_id": normalized}


def extract_reservas_from_response(data: Any) -> tuple:
    """
    Normaliza a resposta do CVCRM para uma lista de (reserva_id_str, info_dict).
    Suporta:
      - Lista: [{idreserva: ..., ...}, ...]
      - Dict com chaves numéricas: {"123": {...}, "456": {...}}
      - Wrapper paginado: {"data": [...], "meta": {...}} ou {"reservas": [...]}
    Retorna: (lista_de_pares, total_paginas)
    """
    total_pages = 1

    if isinstance(data, list):
        pairs = [(str(item.get("idreserva") or item.get("id") or i), item) for i, item in enumerate(data)]
        return pairs, total_pages

    if isinstance(data, dict):
        # Detecta wrapper paginado (chave "data" com lista dentro)
        for wrapper_key in ("data", "reservas", "items", "result", "results"):
            if wrapper_key in data and isinstance(data[wrapper_key], list):
                items_list = data[wrapper_key]
                # Tenta extrair info de paginação
                meta = data.get("meta") or data.get("pagination") or data.get("paginator") or {}
                if isinstance(meta, dict):
                    last_page = meta.get("last_page") or meta.get("totalPages") or meta.get("total_pages")
                    if last_page:
                        total_pages = int(last_page)
                pairs = [(str(item.get("idreserva") or item.get("id") or i), item) for i, item in enumerate(items_list)]
                return pairs, total_pages

        # Dict com chaves numéricas (ou IDs de reserva como chave)
        pairs = []
        for key, value in data.items():
            if not isinstance(value, dict):
                continue
            res_id = str(value.get("idreserva") or value.get("id") or key).strip()
            pairs.append((res_id, value))
        return pairs, total_pages

    return [], total_pages


async def fetch_all_reservas_for_situacao(sit_id: int) -> List[Dict[str, Any]]:
    """Busca TODAS as páginas do CVCRM para uma situação, com suporte a paginação."""
    meta = SITUACOES_META.get(int(sit_id) if sit_id is not None else -1)
    if not meta:
        raise RuntimeError(f"Situação interna não mapeada: {sit_id}")

    source_key = str(meta.get("source") or "cvcrm")
    source_cfg = CRM_SOURCES.get(source_key)
    if not source_cfg or not source_cfg.get("enabled"):
        return []

    external_id = int(meta.get("external_id") or sit_id)
    all_pairs: List[tuple] = []
    page = 1

    while True:
        try:
            response = await fetch_cvcrm_reservas(sit_id, timeout_seconds=15, pagina=page)
        except Exception as exc:
            print(f"[SYNC] Timeout/erro na situacao {sit_id} pagina {page}: {exc}")
            raise RuntimeError(f"Falha ao consultar CVCRM na situacao {sit_id}, pagina {page}: {exc}") from exc

        if response.status_code == 204:
            break
        if response.status_code != 200:
            print(f"[SYNC] Fonte {source_key} situacao {external_id} pagina {page}: HTTP {response.status_code}")
            raise RuntimeError(
                f"CVCRM ({source_key}) retornou HTTP {response.status_code} para situacao {external_id}, pagina {page}"
            )

        try:
            data = response.json()
        except Exception as exc:
            print(f"[SYNC] Situacao {sit_id} pagina {page}: resposta nao e JSON valido")
            raise RuntimeError(f"Resposta invalida do CVCRM na situacao {sit_id}, pagina {page}") from exc

        pairs, total_pages = extract_reservas_from_response(data)
        print(f"[SYNC] Fonte {source_key} situacao {external_id} pagina {page}/{total_pages}: {len(pairs)} reservas")
        all_pairs.extend(pairs)

        if page >= total_pages or not pairs:
            break
        page += 1

    # Transforma em lista de dicts adicionando o reserva_id como campo auxiliar
    result = []
    for res_id, info in all_pairs:
        if not res_id or res_id == "None":
            continue
        entry = dict(info)
        entry["_reserva_id_externo"] = res_id
        entry["_reserva_id_normalizado"] = build_reserva_key(source_key, res_id)
        entry["_reserva_source"] = source_key
        entry["_situacao_id_externo"] = external_id
        result.append(entry)

    return result


async def build_situacao_lookup() -> Dict[str, Dict[str, Any]]:
    lookup: Dict[str, Dict[str, Any]] = {}

    try:
        distribuicoes = (
            supabase.table("distribuicoes")
            .select("reserva_id,situacao_id,situacao_nome")
            .execute()
            .data
            or []
        )
        for item in distribuicoes:
            reserva_id = str(item.get("reserva_id") or "").strip()
            if not reserva_id:
                continue
            lookup[reserva_id] = {
                "situacao_id": item.get("situacao_id"),
                "situacao_nome": item.get("situacao_nome") or SITUACOES_NOMES.get(int(item.get("situacao_id") or 0), "Não informado"),
                "source": "distribuicoes",
            }
    except Exception:
        pass

    try:
        logs_transferencias = (
            supabase.table("logs_transferencias")
            .select("reserva_id,situacao_id,situacao_nome,data_transferencia")
            .order("data_transferencia", desc=True)
            .limit(10000)
            .execute()
            .data
            or []
        )
        for item in logs_transferencias:
            reserva_id = str(item.get("reserva_id") or "").strip()
            if not reserva_id or reserva_id in lookup:
                continue
            lookup[reserva_id] = {
                "situacao_id": item.get("situacao_id"),
                "situacao_nome": item.get("situacao_nome") or SITUACOES_NOMES.get(int(item.get("situacao_id") or 0), "Não informado"),
                "source": "logs_transferencias",
            }
    except Exception as exc:
        if not is_missing_transfer_logs_table_error(str(exc)):
            raise

    for sit_id in SITUACOES_IDS:
        try:
            reservas = await fetch_all_reservas_for_situacao(sit_id)
            for info in reservas:
                reserva_id = str(info.get("_reserva_id_normalizado") or "").strip()
                if not reserva_id or reserva_id in lookup:
                    continue
                lookup[reserva_id] = {
                    "situacao_id": sit_id,
                    "situacao_nome": info.get("situacao_nome") or SITUACOES_NOMES.get(sit_id, "Não informado"),
                    "source": "cvcrm",
                }
        except Exception:
            continue

    return lookup


def build_analista_nome_lookup() -> Dict[int, str]:
    try:
        analistas = supabase.table("analistas").select("id,nome").execute().data or []
    except Exception:
        return {}

    lookup: Dict[int, str] = {}
    for analista in analistas:
        analista_id = analista.get("id")
        if analista_id is None:
            continue
        lookup[int(analista_id)] = (analista.get("nome") or "").strip()
    return lookup


async def backfill_historico_metadata(limit: int = 5000) -> Dict[str, Any]:
    historico_rows = (
        supabase.table("historico")
        .select("id,reserva_id,analista_id,analista_nome,situacao_id,situacao_nome,data_fim")
        .order("data_fim", desc=True)
        .limit(limit)
        .execute()
        .data
        or []
    )

    candidates = []
    for row in historico_rows:
        missing_situacao = (HISTORICO_HAS_SITUACAO_ID and row.get("situacao_id") is None) or (
            HISTORICO_HAS_SITUACAO_NOME and not (row.get("situacao_nome") or "").strip()
        )
        missing_analista_nome = HISTORICO_HAS_ANALISTA_NOME and not (row.get("analista_nome") or "").strip()
        if missing_situacao or missing_analista_nome:
            candidates.append(row)

    situacao_lookup = await build_situacao_lookup() if (HISTORICO_HAS_SITUACAO_ID or HISTORICO_HAS_SITUACAO_NOME) else {}
    analista_lookup = build_analista_nome_lookup() if HISTORICO_HAS_ANALISTA_NOME else {}

    updated_rows = 0
    updated_situacao = 0
    updated_analista_nome = 0
    unresolved: List[str] = []
    source_breakdown: Dict[str, int] = {}

    for row in candidates:
        update_payload: Dict[str, Any] = {}
        reserva_id = str(row.get("reserva_id") or "").strip()

        situacao_info = situacao_lookup.get(reserva_id) if reserva_id else None
        if situacao_info:
            if HISTORICO_HAS_SITUACAO_ID and row.get("situacao_id") is None and situacao_info.get("situacao_id") is not None:
                update_payload["situacao_id"] = situacao_info.get("situacao_id")
            if HISTORICO_HAS_SITUACAO_NOME and not (row.get("situacao_nome") or "").strip() and situacao_info.get("situacao_nome"):
                update_payload["situacao_nome"] = situacao_info.get("situacao_nome")

        analista_id = row.get("analista_id")
        if HISTORICO_HAS_ANALISTA_NOME and not (row.get("analista_nome") or "").strip() and analista_id is not None:
            analista_nome = analista_lookup.get(int(analista_id))
            if analista_nome:
                update_payload["analista_nome"] = analista_nome

        if not update_payload:
            if reserva_id:
                unresolved.append(reserva_id)
            continue

        supabase.table("historico").update(update_payload).eq("id", row["id"]).execute()
        updated_rows += 1
        if "situacao_id" in update_payload or "situacao_nome" in update_payload:
            updated_situacao += 1
            source = (situacao_info or {}).get("source", "desconhecido")
            source_breakdown[source] = source_breakdown.get(source, 0) + 1
        if "analista_nome" in update_payload:
            updated_analista_nome += 1

    return {
        "status": "ok",
        "analisados": len(historico_rows),
        "candidatos": len(candidates),
        "atualizados": updated_rows,
        "atualizados_situacao": updated_situacao,
        "atualizados_analista_nome": updated_analista_nome,
        "nao_encontrados": len(unresolved),
        "fontes_situacao": source_breakdown,
        "exemplos_nao_encontrados": unresolved[:20],
    }


def parse_history_datetime(value: Optional[str]) -> Optional[datetime.datetime]:
    normalized_value = (value or "").strip()
    if not normalized_value:
        return None

    try:
        return datetime.datetime.fromisoformat(normalized_value.replace("Z", "+00:00"))
    except ValueError:
        return None


def get_local_today(reference: Optional[datetime.datetime] = None) -> datetime.date:
    base = reference or datetime.datetime.now(datetime.timezone.utc)
    if base.tzinfo is None:
        base = base.replace(tzinfo=datetime.timezone.utc)
    return base.astimezone(APP_TIMEZONE).date()


def get_app_now(reference: Optional[datetime.datetime] = None) -> datetime.datetime:
    base = reference or datetime.datetime.now(datetime.timezone.utc)
    if base.tzinfo is None:
        base = base.replace(tzinfo=datetime.timezone.utc)
    return base.astimezone(APP_TIMEZONE)


def get_effective_total_hoje(analyst: Dict[str, Any], reference: Optional[datetime.datetime] = None) -> int:
    reference_dt = reference or datetime.datetime.now(datetime.timezone.utc)
    ultima_atribuicao = parse_history_datetime(str(analyst.get("ultima_atribuicao") or ""))
    if not ultima_atribuicao:
        return 0

    if ultima_atribuicao.tzinfo is None:
        # Compatibilidade: timestamps antigos sem timezone são interpretados como UTC.
        last_assignment_day = ultima_atribuicao.replace(tzinfo=datetime.timezone.utc).astimezone(APP_TIMEZONE).date()
    else:
        last_assignment_day = ultima_atribuicao.astimezone(APP_TIMEZONE).date()

    if last_assignment_day != get_local_today(reference_dt):
        return 0

    return int(analyst.get("total_hoje") or 0)


def build_next_total_hoje(analyst: Dict[str, Any], increment: int = 1, reference: Optional[datetime.datetime] = None) -> int:
    return get_effective_total_hoje(analyst, reference=reference) + increment


def sort_analysts_for_queue(analysts: List[Dict[str, Any]], reference: Optional[datetime.datetime] = None) -> List[Dict[str, Any]]:
    reference_dt = reference or datetime.datetime.now(datetime.timezone.utc)

    def analyst_sort_key(analyst: Dict[str, Any]):
        total_hoje = get_effective_total_hoje(analyst, reference=reference_dt)
        ultima_atribuicao = parse_history_datetime(str(analyst.get("ultima_atribuicao") or ""))
        if ultima_atribuicao is None:
            last_assignment_key = datetime.datetime.min.replace(tzinfo=datetime.timezone.utc)
        elif ultima_atribuicao.tzinfo is None:
            last_assignment_key = ultima_atribuicao.replace(tzinfo=datetime.timezone.utc)
        else:
            last_assignment_key = ultima_atribuicao.astimezone(datetime.timezone.utc)

        return (total_hoje, last_assignment_key, (analyst.get("nome") or "").lower())

    return sorted(analysts, key=analyst_sort_key)


def build_sorted_counter(counter_map: Dict[str, int], *, limit: Optional[int] = None) -> List[Dict[str, Any]]:
    items = [
        {"label": label, "total": total}
        for label, total in counter_map.items()
    ]
    items.sort(key=lambda item: (-item["total"], item["label"]))
    if limit is not None:
        return items[:limit]
    return items


def build_daily_series(counter_map: Dict[str, int], *, limit: int = 14) -> List[Dict[str, Any]]:
    ordered_keys = sorted(counter_map.keys())[-limit:]
    return [
        {
            "key": key,
            "label": datetime.datetime.strptime(key, "%Y-%m-%d").strftime("%d/%m"),
            "total": counter_map[key],
        }
        for key in ordered_keys
    ]


def build_monthly_series(counter_map: Dict[str, int], *, limit: int = 12) -> List[Dict[str, Any]]:
    ordered_keys = sorted(counter_map.keys())[-limit:]
    return [
        {
            "key": key,
            "label": datetime.datetime.strptime(f"{key}-01", "%Y-%m-%d").strftime("%m/%Y"),
            "total": counter_map[key],
        }
        for key in ordered_keys
    ]

# --- MODELOS DE DADOS ---

class LoginRequest(BaseModel):
    analista_id: int
    senha: str


class LoginEmailRequest(BaseModel):
    email: str
    senha: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    nova_senha: str


class ManagerLoginRequest(BaseModel):
    usuario: str
    senha: str


class AdminCreateRequest(BaseModel):
    email: str
    senha: str
    username: Optional[str] = None
    ativo: bool = True


class SessionRevokeRequest(BaseModel):
    role: str
    user_id: int
    reason: Optional[str] = None

class AnalystCreate(BaseModel):
    nome: str
    email: str
    senha: str
    permissoes: List[int]
    status: str = "ativo"

class AnalystUpdate(BaseModel):
    nome: Optional[str] = None
    email: Optional[str] = None
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

class TransferirMassaRequest(BaseModel):
    reserva_ids: List[str]
    analista_origem_id: int
    analista_destino_id: int
    motivo: str


class ChangePasswordRequest(BaseModel):
    analista_id: int
    senha_atual: str
    nova_senha: str

# --- LÓGICA DE DISTRIBUIÇÃO ---

async def get_next_analyst(sit_id: int, exclude_ids: Optional[List[int]] = None):
    try:
        exclude_ids = exclude_ids or []
        response = supabase.table("analistas") \
            .select("*") \
            .eq("status", "ativo") \
            .eq("is_online", True) \
            .execute()
        
        if not response.data:
            return None

        for analista in sort_analysts_for_queue(response.data):
            if int(analista.get("id")) in [int(x) for x in exclude_ids]:
                continue
            permissoes = analista.get("permissoes") or []
            if int(sit_id) in [int(p) for p in permissoes]:
                return analista
    except Exception as e:
        print(f"Erro na fila de analistas: {e}")
    return None

async def perform_sync():
    """
    Sincroniza reservas do CVCRM com a mesa local.
    - Busca TODAS as páginas de cada situação (suporte a paginação)
    - Trata robustamente diferentes formatos de resposta do CRM
    - Registra resultado em _LAST_SYNC_STATE para auditoria
    """
    async with _SYNC_LOCK:
        ids_no_crm: set[str] = set()
        erros_sync: List[str] = []
        por_situacao: Dict[str, int] = {}
        situacoes_ok: set[int] = set()
        situacoes_monitoradas_sync: set[int] = set()
        situacoes_falharam: List[Dict[str, Any]] = []
        situacoes_ignoradas: List[Dict[str, Any]] = []
        removidas_na_limpeza = 0
        limpeza_aplicada = False
        limpeza_escopo = "nenhuma"
        inicio = datetime.datetime.now(datetime.timezone.utc)

        for sit_id in SITUACOES_IDS:
            sit_meta = SITUACOES_META.get(int(sit_id), {})
            sit_nome = SITUACOES_NOMES.get(sit_id, str(sit_id))
            source_key = str(sit_meta.get("source") or "cvcrm")
            source_cfg = CRM_SOURCES.get(source_key) or {}

            if not source_cfg.get("enabled"):
                por_situacao[sit_nome] = 0
                situacoes_ignoradas.append({"situacao_id": sit_id, "situacao_nome": sit_nome, "fonte": source_key})
                continue

            situacoes_monitoradas_sync.add(int(sit_id))

            try:
                reservas = await fetch_all_reservas_for_situacao(sit_id)
                por_situacao[sit_nome] = len(reservas)
                situacoes_ok.add(int(sit_id))
                print(f"[SYNC] Situacao '{sit_nome}' ({sit_id}): {len(reservas)} reservas encontradas")

                for info in reservas:
                    res_id = str(info.get("_reserva_id_normalizado") or "").strip()
                    if not res_id or res_id == "None":
                        continue
                    ids_no_crm.add(res_id)

                    try:
                        # Busca se já existe distribuição para esta reserva
                        ativa = supabase.table("distribuicoes").select("*").eq("reserva_id", res_id).execute()

                        if not ativa.data:
                            # NOVA DISTRIBUIÇÃO
                            analista = await get_next_analyst(sit_id)
                            now = datetime.datetime.now().isoformat()
                            titular = info.get("titular") or {}
                            unidade = info.get("unidade") or {}
                            analista_id = analista["id"] if analista else None
                            data_atribuicao = now if analista else None

                            supabase.table("distribuicoes").upsert(
                                {
                                    "reserva_id": res_id,
                                    "cliente": titular.get("nome", "Desconhecido") if isinstance(titular, dict) else "Desconhecido",
                                    "empreendimento": unidade.get("empreendimento", "N/A") if isinstance(unidade, dict) else "N/A",
                                    "unidade": unidade.get("unidade", "N/A") if isinstance(unidade, dict) else "N/A",
                                    "situacao_id": sit_id,
                                    "situacao_nome": SITUACOES_NOMES.get(sit_id, "Geral"),
                                    "analista_id": analista_id,
                                    "data_atribuicao": data_atribuicao,
                                },
                                on_conflict="reserva_id",
                                ignore_duplicates=True,
                            ).execute()

                            if analista:
                                supabase.table("analistas").update({
                                    "ultima_atribuicao": now,
                                    "total_hoje": build_next_total_hoje(analista)
                                }).eq("id", analista["id"]).execute()
                        else:
                            # RESERVA JÁ EXISTE — verifica reassign e mudança de situação
                            dist_db = ativa.data[0]
                            analista_atual_id = dist_db.get("analista_id")

                            # AUTO-REASSIGN: se está sem analista ou com analista inativo/offline
                            deve_reatribuir = not analista_atual_id
                            if analista_atual_id:
                                analista_atual = supabase.table("analistas").select("*").eq("id", analista_atual_id).execute()
                                if not analista_atual.data:
                                    deve_reatribuir = True
                                else:
                                    a = analista_atual.data[0]
                                    if a.get("status") != "ativo" or not a.get("is_online"):
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
                                        "total_hoje": build_next_total_hoje(proximo)
                                    }).eq("id", proximo["id"]).execute()
                                else:
                                    supabase.table("distribuicoes").update({
                                        "analista_id": None,
                                        "data_atribuicao": None,
                                        "situacao_id": sit_id,
                                        "situacao_nome": SITUACOES_NOMES.get(sit_id, "Geral")
                                    }).eq("reserva_id", res_id).execute()

                            if int(dist_db.get("situacao_id") or 0) != int(sit_id):
                                supabase.table("distribuicoes").update({
                                    "situacao_id": sit_id,
                                    "situacao_nome": SITUACOES_NOMES.get(sit_id, "Geral")
                                }).eq("reserva_id", res_id).execute()

                    except Exception as item_err:
                        msg = f"Reserva {res_id} (sit {sit_id}): {item_err}"
                        print(f"[SYNC][ERRO] {msg}")
                        erros_sync.append(msg)

            except Exception as sit_err:
                msg = f"Situacao {sit_nome} ({sit_id}): {sit_err}"
                print(f"[SYNC][ERRO] {msg}")
                erros_sync.append(msg)
                por_situacao[sit_nome] = -1  # -1 indica falha de fetch
                situacoes_falharam.append({"situacao_id": sit_id, "situacao_nome": sit_nome, "fonte": source_key})

        # REMOÇÃO SEGURA: remove apenas reservas realmente fora do CRM,
        # sem apagar lotes inteiros quando houver falha parcial de coleta.
        try:
            locais = supabase.table("distribuicoes").select("reserva_id,situacao_id").execute().data or []
            if locais and situacoes_ok:
                limpeza_aplicada = True
                if situacoes_falharam or situacoes_ignoradas:
                    limpeza_escopo = "parcial"
                else:
                    limpeza_escopo = "total"

                for registro in locais:
                    reserva_id_local = str(registro.get("reserva_id") or "").strip()
                    if not reserva_id_local:
                        continue

                    try:
                        situacao_local = int(registro.get("situacao_id") or 0)
                    except (TypeError, ValueError):
                        situacao_local = 0

                    if situacao_local and situacao_local not in situacoes_monitoradas_sync:
                        continue

                    if situacoes_falharam:
                        if situacao_local not in situacoes_ok:
                            continue

                    if reserva_id_local not in ids_no_crm:
                        supabase.table("distribuicoes").delete().eq("reserva_id", reserva_id_local).execute()
                        removidas_na_limpeza += 1
            else:
                limpeza_escopo = "ignorada"
        except Exception as rem_err:
            erros_sync.append(f"Remocao: {rem_err}")

        fim = datetime.datetime.now(datetime.timezone.utc)
        _LAST_SYNC_STATE["timestamp"] = fim.isoformat()
        _LAST_SYNC_STATE["total_no_crm"] = len(ids_no_crm)
        _LAST_SYNC_STATE["por_situacao"] = por_situacao
        _LAST_SYNC_STATE["erros"] = erros_sync[-50:]  # guarda os últimos 50 erros
        _LAST_SYNC_STATE["duracao_segundos"] = round((fim - inicio).total_seconds(), 2)
        _LAST_SYNC_STATE["situacoes_falharam"] = situacoes_falharam
        _LAST_SYNC_STATE["situacoes_ignoradas"] = situacoes_ignoradas
        _LAST_SYNC_STATE["limpeza_aplicada"] = limpeza_aplicada
        _LAST_SYNC_STATE["limpeza_escopo"] = limpeza_escopo
        _LAST_SYNC_STATE["removidas_na_limpeza"] = removidas_na_limpeza

        if erros_sync:
            print(
                f"[SYNC] Concluido com {len(erros_sync)} erros. "
                f"Total CRM: {len(ids_no_crm)}. Limpeza: {limpeza_escopo}, removidas: {removidas_na_limpeza}"
            )
        else:
            print(
                f"[SYNC] OK — {len(ids_no_crm)} reservas, {_LAST_SYNC_STATE['duracao_segundos']}s. "
                f"Limpeza: {limpeza_escopo}, removidas: {removidas_na_limpeza}"
            )

async def background_task():
    while True:
        await perform_sync()
        await asyncio.sleep(SYNC_INTERVAL_SECONDS)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(background_task())

# --- ENDPOINTS ---

@app.get("/api/gestor/sync-status")
async def sync_status(authorization: Optional[str] = Header(default=None)):
    """
    Retorna o resultado do último ciclo de sincronização com o CVCRM.
    Útil para diagnosticar se reservas estão sendo puxadas corretamente.
    """
    require_manager_auth(authorization)
    mesa_count = 0
    try:
        mesa_count = len(supabase.table("distribuicoes").select("reserva_id").execute().data or [])
    except Exception:
        pass
    return {
        **_LAST_SYNC_STATE,
        "total_na_mesa_local": mesa_count,
        "situacoes_monitoradas": SITUACOES_NOMES,
    }


@app.get("/api/gestor/debug/cvcrm")
async def debug_cvcrm_response(
    sit_id: int = Query(..., description="ID da situacao a inspecionar"),
    pagina: int = Query(default=1, ge=1),
    authorization: Optional[str] = Header(default=None),
):
    """
    Inspeciona a resposta crua do CVCRM para uma situação específica.
    Útil para entender o formato de retorno e detectar paginação.
    """
    require_manager_auth(authorization)
    try:
        response = await fetch_cvcrm_reservas(sit_id, timeout_seconds=15, pagina=pagina)
        status_code = response.status_code
        if status_code != 200:
            return {
                "status_code": status_code,
                "situacao_id": sit_id,
                "pagina": pagina,
                "conteudo_bruto": response.text[:500],
            }
        data = response.json()
        data_type = type(data).__name__
        pairs, total_pages = extract_reservas_from_response(data)
        primeiro_item = pairs[0][1] if pairs else None
        return {
            "status_code": status_code,
            "situacao_id": sit_id,
            "pagina": pagina,
            "total_paginas_detectadas": total_pages,
            "tipo_resposta": data_type,
            "chaves_raiz": list(data.keys()) if isinstance(data, dict) else None,
            "total_reservas_nesta_pagina": len(pairs),
            "campos_primeiro_item": list(primeiro_item.keys()) if isinstance(primeiro_item, dict) else None,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/gestor/redistribuir")
async def redistribute_all(authorization: Optional[str] = Header(default=None)):
    """Limpa as mesas e força uma nova distribuição do zero."""
    try:
        require_manager_auth(authorization)
        supabase.table("distribuicoes").delete().neq("reserva_id", "0").execute()
        await perform_sync()
        return {"status": "sucesso"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/gestor/zerar-dados")
async def reset_all_data(authorization: Optional[str] = Header(default=None)):
    """Limpa a mesa atual e reinicia a ordem de distribuição sem excluir histórico."""
    try:
        require_manager_auth(authorization)
        supabase.table("distribuicoes").delete().neq("reserva_id", "0").execute()
        supabase.table("analistas").update({
            "total_hoje": 0,
            "ultima_atribuicao": None
        }).neq("id", 0).execute()
        return {"status": "ok", "message": "Mesa limpa e ordem de distribuição reiniciada"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/gestor/login")
async def manager_login(req: ManagerLoginRequest):
    admin = verify_admin_credentials(req.usuario, req.senha)
    
    if not admin:
        raise HTTPException(status_code=401, detail="Usuário ou senha do admin inválidos")

    return {
        "id": admin.get("id"),
        "usuario": admin.get("username"),
        "email": admin.get("email"),
        "token": create_manager_token(admin),
        "session_version": get_admin_session_version(admin),
    }


@app.get("/api/gestor/admins")
async def list_admin_users(authorization: Optional[str] = Header(default=None)):
    require_manager_auth(authorization)
    try:
        try:
            res = (
                supabase.table("administradores")
                .select("id,username,email,ativo,data_criacao,updated_at,session_version")
                .order("data_criacao", desc=True)
                .execute()
            )
        except Exception:
            res = (
                supabase.table("administradores")
                .select("id,username,email,ativo,data_criacao,updated_at")
                .order("data_criacao", desc=True)
                .execute()
            )
        return res.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/gestor/admins")
async def create_admin_user(req: AdminCreateRequest, authorization: Optional[str] = Header(default=None)):
    require_manager_auth(authorization)

    email = (req.email or "").strip().lower()
    senha = (req.senha or "").strip()
    username_input = (req.username or "").strip().lower()

    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Informe um e-mail válido")
    if not senha:
        raise HTTPException(status_code=400, detail="Senha é obrigatória")

    strength = evaluate_password_strength(senha)
    if not strength["is_acceptable"]:
        raise HTTPException(status_code=400, detail=f"Senha fraca: {strength['label']}")

    try:
        existing_email = (
            supabase.table("administradores")
            .select("id")
            .eq("email", email)
            .limit(1)
            .execute()
        )
        if existing_email.data:
            raise HTTPException(status_code=409, detail="Já existe administrador com este e-mail")

        base_username = username_input or username_from_email(email)
        username = ensure_unique_admin_username(base_username)

        insert_payload = {
            "username": username,
            "email": email,
            "senha": hash_password(senha),
            "ativo": bool(req.ativo),
            "session_version": 1,
        }
        try:
            created = (
                supabase.table("administradores")
                .insert(insert_payload)
                .execute()
                .data
                or []
            )
        except Exception as insert_exc:
            if "session_version" in str(insert_exc):
                insert_payload.pop("session_version", None)
                created = (
                    supabase.table("administradores")
                    .insert(insert_payload)
                    .execute()
                    .data
                    or []
                )
            else:
                raise

        if not created:
            raise HTTPException(status_code=500, detail="Falha ao criar administrador")

        row = created[0]
        return {
            "id": row.get("id"),
            "username": row.get("username"),
            "email": row.get("email"),
            "ativo": row.get("ativo", True),
            "data_criacao": row.get("data_criacao"),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/gestor/sessoes/revogar")
async def revoke_user_sessions(req: SessionRevokeRequest, authorization: Optional[str] = Header(default=None)):
    actor_payload = require_manager_auth(authorization)
    actor = get_admin_identity(int(actor_payload.get("user_id") or 0))

    role = (req.role or "").strip().lower()
    if role not in {"admin", "analyst"}:
        raise HTTPException(status_code=400, detail="Role inválida. Use 'admin' ou 'analyst'.")

    user_id = int(req.user_id)
    next_version = bump_session_version(role, user_id)

    redistribuidas = 0
    sem_destino = 0

    if role == "analyst":
        try:
            offline_result = await set_online_status(
                StatusFilaRequest(analista_id=user_id, online=False),
                authorization=authorization,
            )
            redistribuidas = int(offline_result.get("redistribuidas") or 0)
            sem_destino = int(offline_result.get("sem_destino") or 0)
        except Exception:
            # revogação de sessão continua válida mesmo sem conseguir ajustar fila.
            pass

    record_session_revoke_audit(
        actor=actor,
        role=role,
        user_id=user_id,
        reason=req.reason or "manual",
        session_version=next_version,
    )

    return {
        "status": "ok",
        "role": role,
        "user_id": user_id,
        "session_version": next_version,
        "redistribuidas": redistribuidas,
        "sem_destino": sem_destino,
        "reason": (req.reason or "manual").strip() or "manual",
    }


@app.post("/api/login")
async def login(req: LoginRequest):
    try:
        res = supabase.table("analistas").select("*").eq("id", req.analista_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")

        analista = res.data[0]
        if analista.get("status") == "inativo":
            raise HTTPException(status_code=403, detail="Conta desativada. Entre em contato com o administrador.")
        senha_recebida = (req.senha or "").strip()
        senha_cadastrada = str(analista.get("senha") or "").strip()

        if not validate_analyst_password(req.analista_id, senha_recebida, senha_cadastrada):
            raise HTTPException(status_code=401, detail="Senha incorreta")
        analyst_payload = dict(analista)
        analyst_payload["token"] = create_analyst_token(analista)
        analyst_payload["session_version"] = get_analyst_session_version(analista)
        return analyst_payload
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/login/email")
async def login_email(req: LoginEmailRequest):
    """Login do analista com e-mail e senha."""
    email_normalizado = (req.email or "").strip().lower()
    senha_recebida = (req.senha or "").strip()

    if not email_normalizado or not senha_recebida:
        raise HTTPException(status_code=400, detail="E-mail e senha são obrigatórios")

    try:
        res = supabase.table("analistas").select("*").eq("email", email_normalizado).execute()
        if not res.data:
            raise HTTPException(status_code=401, detail="E-mail ou senha incorretos")

        analista = res.data[0]

        if analista.get("status") == "inativo":
            raise HTTPException(status_code=403, detail="Conta desativada. Entre em contato com o administrador.")

        senha_cadastrada = str(analista.get("senha") or "").strip()
        if not validate_analyst_password(analista["id"], senha_recebida, senha_cadastrada):
            raise HTTPException(status_code=401, detail="E-mail ou senha incorretos")

        analyst_payload = dict(analista)
        analyst_payload["token"] = create_analyst_token(analista)
        analyst_payload["session_version"] = get_analyst_session_version(analista)
        return analyst_payload
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/analista/esqueceu-senha")
async def forgot_password(req: ForgotPasswordRequest):
    """Solicita redefinição de senha. Sempre retorna 200 para não vazar existência de e-mails."""
    email_normalizado = (req.email or "").strip().lower()
    if not email_normalizado:
        raise HTTPException(status_code=400, detail="Informe o e-mail")

    RESPOSTA_PADRAO = {
        "status": "ok",
        "message": "Se o e-mail estiver cadastrado, você receberá as instruções em breve.",
    }

    try:
        res = supabase.table("analistas").select("id,nome,email,status").eq("email", email_normalizado).execute()
        if not res.data:
            return RESPOSTA_PADRAO

        analista = res.data[0]
        if analista.get("status") == "inativo":
            return RESPOSTA_PADRAO

        plain_token, token_hash = generate_reset_token()
        expires_at = (
            datetime.datetime.now(datetime.timezone.utc)
            + datetime.timedelta(minutes=RESET_TOKEN_TTL_MINUTES)
        ).isoformat()

        supabase.table("analistas").update({
            "reset_token_hash": token_hash,
            "reset_token_expires": expires_at,
        }).eq("id", analista["id"]).execute()

        reset_link = f"{FRONTEND_URL}?reset_token={plain_token}"
        email_sent = send_reset_email(
            to_email=analista["email"],
            reset_link=reset_link,
            analyst_name=analista.get("nome", "Analista"),
        )
        if not email_sent:
            supabase.table("analistas").update({
                "reset_token_hash": None,
                "reset_token_expires": None,
            }).eq("id", analista["id"]).execute()
            print(
                f"[ERRO] Reset de senha não entregue para {email_normalizado}. "
                "Token invalidado após falha de SMTP."
            )

        return RESPOSTA_PADRAO
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/analista/resetar-senha")
async def reset_password(req: ResetPasswordRequest):
    """Aplica nova senha usando o token de redefinição recebido por e-mail."""
    plain_token = (req.token or "").strip()
    nova_senha = (req.nova_senha or "").strip()

    if not plain_token or not nova_senha:
        raise HTTPException(status_code=400, detail="Token e nova senha são obrigatórios")

    password_strength = evaluate_password_strength(nova_senha)
    if not password_strength["is_acceptable"]:
        raise HTTPException(
            status_code=400,
            detail="A senha está fraca. Use pelo menos 8 caracteres com letras, números e símbolos.",
        )

    token_hash = hashlib.sha256(plain_token.encode("utf-8")).hexdigest()
    now = datetime.datetime.now(datetime.timezone.utc)

    try:
        res = (
            supabase.table("analistas")
            .select("id,reset_token_hash,reset_token_expires")
            .eq("reset_token_hash", token_hash)
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=400, detail="Token inválido ou já utilizado")

        analista = res.data[0]
        expires_str = (analista.get("reset_token_expires") or "").strip()
        if not expires_str:
            raise HTTPException(status_code=400, detail="Token inválido")

        expires_at = datetime.datetime.fromisoformat(expires_str.replace("Z", "+00:00"))
        if now > expires_at:
            raise HTTPException(
                status_code=400,
                detail="Token expirado. Solicite um novo link de redefinição.",
            )

        supabase.table("analistas").update({
            "senha": hash_password(nova_senha),
            "reset_token_hash": None,
            "reset_token_expires": None,
        }).eq("id", analista["id"]).execute()

        bump_session_version("analyst", int(analista["id"]))

        return {"status": "ok", "message": "Senha redefinida com sucesso. Faça login com sua nova senha."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analista/alterar-senha")
async def change_password(req: ChangePasswordRequest, authorization: Optional[str] = Header(default=None)):
    try:
        require_analyst_auth(authorization, expected_analyst_id=req.analista_id)
        res = supabase.table("analistas").select("id,nome,senha").eq("id", req.analista_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")

        analyst = res.data[0]
        current_password = (req.senha_atual or "").strip()
        new_password = (req.nova_senha or "").strip()

        if not current_password or not new_password:
            raise HTTPException(status_code=400, detail="Preencha a senha atual e a nova senha")

        if not validate_analyst_password(req.analista_id, current_password, str(analyst.get("senha") or "")):
            raise HTTPException(status_code=401, detail="Senha atual incorreta")

        if hmac.compare_digest(current_password, new_password):
            raise HTTPException(status_code=400, detail="A nova senha deve ser diferente da senha atual")

        password_strength = evaluate_password_strength(new_password)
        if not password_strength["is_acceptable"]:
            raise HTTPException(status_code=400, detail="A nova senha está fraca. Use pelo menos 8 caracteres com combinação de letras, números e símbolos.")

        supabase.table("analistas").update({"senha": hash_password(new_password)}).eq("id", req.analista_id).execute()
        bump_session_version("analyst", int(req.analista_id))
        return {"status": "ok", "message": "Senha alterada com sucesso"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/analista/status-fila")
async def set_online_status(req: StatusFilaRequest, authorization: Optional[str] = Header(default=None)):
    try:
        if not authorization:
            raise HTTPException(status_code=401, detail="Autenticação obrigatória para alterar status da fila")

        scheme, _, token = authorization.partition(" ")
        authorized_as_admin = scheme.lower() == "bearer" and bool(verify_manager_token(token))

        if not authorized_as_admin:
            require_analyst_auth(authorization, expected_analyst_id=req.analista_id)
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
                    "total_hoje": build_next_total_hoje(proximo)
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
async def listar_analistas(authorization: Optional[str] = Header(default=None)):
    try:
        require_authenticated_user(authorization)
        res = supabase.table("analistas").select("*").order("nome").execute()
        return res.data or []
    except HTTPException:
        raise
    except:
        return []

@app.get("/api/mesa/{analista_id}")
async def get_mesa(analista_id: int, authorization: Optional[str] = Header(default=None)):
    require_analyst_auth(authorization, expected_analyst_id=analista_id)
    res = supabase.table("distribuicoes").select("*").eq("analista_id", analista_id).execute()
    return res.data or []

@app.get("/api/metricas/{analista_id}")
async def get_metrics(analista_id: int, authorization: Optional[str] = Header(default=None)):
    require_analyst_auth(authorization, expected_analyst_id=analista_id)
    now = datetime.datetime.now()
    hoje_str = now.strftime("%Y-%m-%d")
    def count_period(since):
        q = supabase.table("historico").select("id", count="exact").eq("analista_id", analista_id).gte("data_fim", since).execute()
        return q.count or 0
    return {
        "hoje": count_period(hoje_str),
        "ano": count_period(now.strftime("%Y-01-01"))
    }

@app.get("/api/analista/dashboard/{analista_id}")
async def get_analyst_dashboard(analista_id: int, authorization: Optional[str] = Header(default=None)):
    require_analyst_auth(authorization, expected_analyst_id=analista_id)
    history_fields = ["reserva_id", "cliente", "empreendimento", "unidade", "resultado", "data_fim"]
    if HISTORICO_HAS_SITUACAO_ID:
        history_fields.append("situacao_id")
    if HISTORICO_HAS_SITUACAO_NOME:
        history_fields.append("situacao_nome")

    try:
        history_response = (
            supabase.table("historico")
            .select(",".join(history_fields), count="exact")
            .eq("analista_id", analista_id)
            .order("data_fim", desc=True)
            .limit(5000)
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao carregar dashboard analítico: {e}")

    raw_rows = history_response.data or []
    now = datetime.datetime.now()
    today = now.date()
    current_month = today.strftime("%Y-%m")
    current_year = today.strftime("%Y")

    total_por_dia: Dict[str, int] = {}
    total_por_mes: Dict[str, int] = {}
    total_por_resultado: Dict[str, int] = {}
    total_por_situacao: Dict[str, int] = {}
    total_por_empreendimento: Dict[str, int] = {}
    normalized_rows: List[Dict[str, Any]] = []

    total_hoje = 0
    total_mes = 0
    total_ano = 0

    for row in raw_rows:
        finished_at = parse_history_datetime(row.get("data_fim"))
        if not finished_at:
            continue

        finished_local = finished_at.astimezone() if finished_at.tzinfo else finished_at
        day_key = finished_local.strftime("%Y-%m-%d")
        month_key = finished_local.strftime("%Y-%m")
        year_key = finished_local.strftime("%Y")

        total_por_dia[day_key] = total_por_dia.get(day_key, 0) + 1
        total_por_mes[month_key] = total_por_mes.get(month_key, 0) + 1

        resultado = (row.get("resultado") or "Sem resultado").strip()
        empreendimento = (row.get("empreendimento") or "Não informado").strip()
        situacao_nome = ""
        if HISTORICO_HAS_SITUACAO_NOME:
            situacao_nome = (row.get("situacao_nome") or "").strip()
        if not situacao_nome and HISTORICO_HAS_SITUACAO_ID:
            situacao_nome = SITUACOES_NOMES.get(int(row.get("situacao_id") or 0), "")

        total_por_resultado[resultado] = total_por_resultado.get(resultado, 0) + 1
        if situacao_nome:
            total_por_situacao[situacao_nome] = total_por_situacao.get(situacao_nome, 0) + 1
        total_por_empreendimento[empreendimento] = total_por_empreendimento.get(empreendimento, 0) + 1

        if finished_local.date() == today:
            total_hoje += 1
        if month_key == current_month:
            total_mes += 1
        if year_key == current_year:
            total_ano += 1

        normalized_rows.append({
            "reserva_id": row.get("reserva_id"),
            "cliente": row.get("cliente") or "Não informado",
            "empreendimento": empreendimento,
            "unidade": row.get("unidade") or "Não informado",
            "situacao_nome": situacao_nome or "Não informado",
            "resultado": resultado,
            "data_fim": finished_local.isoformat(),
            "data_fim_label": finished_local.strftime("%d/%m/%Y %H:%M"),
        })

    dias_com_producao = len(total_por_dia)
    media_por_dia = round((len(normalized_rows) / dias_com_producao), 2) if dias_com_producao else 0

    return {
        "resumo": {
            "total": len(normalized_rows),
            "hoje": total_hoje,
            "mes": total_mes,
            "ano": total_ano,
            "media_por_dia": media_por_dia,
            "dias_com_producao": dias_com_producao,
        },
        "series": {
            "por_dia": build_daily_series(total_por_dia, limit=14),
            "por_mes": build_monthly_series(total_por_mes, limit=12),
        },
        "rankings": {
            "por_resultado": build_sorted_counter(total_por_resultado),
            "por_situacao": build_sorted_counter(total_por_situacao),
            "por_empreendimento": build_sorted_counter(total_por_empreendimento, limit=10),
        },
        "schema": {
            "historico_tem_analista_nome": HISTORICO_HAS_ANALISTA_NOME,
            "historico_tem_situacao": HISTORICO_HAS_SITUACAO_ID or HISTORICO_HAS_SITUACAO_NOME,
        },
        "registros": normalized_rows,
        "total_registros": history_response.count or len(normalized_rows),
        "gerado_em": now.isoformat(),
    }

@app.post("/api/concluir")
async def concluir(reserva_id: str, resultado: str, authorization: Optional[str] = Header(default=None)):
    auth_payload = require_analyst_auth(authorization)
    dist = supabase.table("distribuicoes").select("*").eq("reserva_id", reserva_id).execute()
    if not dist.data:
        raise HTTPException(status_code=404, detail="Reserva não encontrada na mesa atual")

    d = dist.data[0]
    if int(d.get("analista_id") or 0) != int(auth_payload.get("user_id") or 0):
        raise HTTPException(status_code=403, detail="Você não tem permissão para concluir esta reserva")

    historico_payload = {
        "reserva_id": d["reserva_id"],
        "cliente": d["cliente"],
        "empreendimento": d["empreendimento"],
        "unidade": d["unidade"],
        "analista_id": d["analista_id"],
        "resultado": resultado,
        "data_fim": datetime.datetime.now().isoformat(),
    }

    if HISTORICO_HAS_ANALISTA_NOME and d.get("analista_id") is not None:
        analyst_response = supabase.table("analistas").select("nome").eq("id", d["analista_id"]).limit(1).execute()
        if analyst_response.data:
            historico_payload["analista_nome"] = analyst_response.data[0].get("nome")

    if HISTORICO_HAS_SITUACAO_ID:
        historico_payload["situacao_id"] = d.get("situacao_id")

    if HISTORICO_HAS_SITUACAO_NOME:
        historico_payload["situacao_nome"] = d.get("situacao_nome") or SITUACOES_NOMES.get(int(d.get("situacao_id") or 0), "Não informado")

    supabase.table("historico").insert(historico_payload).execute()
    supabase.table("distribuicoes").delete().eq("reserva_id", d["reserva_id"]).execute()
    return {"status": "ok"}


@app.post("/api/gestor/historico/backfill")
async def backfill_historico(
    limit: int = Query(default=5000, ge=1, le=20000),
    authorization: Optional[str] = Header(default=None),
):
    require_manager_auth(authorization)
    return await backfill_historico_metadata(limit=limit)

@app.post("/api/analista/transferir")
async def transferir_pasta(req: TransferirPastaRequest, authorization: Optional[str] = Header(default=None)):
    try:
        require_analyst_auth(authorization, expected_analyst_id=req.analista_origem_id)
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

        if destino.get("status") != "ativo":
            raise HTTPException(status_code=400, detail="Analista de destino não está ativo")

        now = datetime.datetime.now().isoformat()

        supabase.table("distribuicoes").update({
            "analista_id": int(destino["id"]),
            "data_atribuicao": now
        }).eq("reserva_id", req.reserva_id).execute()

        supabase.table("analistas").update({
            "ultima_atribuicao": now,
            "total_hoje": build_next_total_hoje(destino)
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
                    detail="Tabela de log não encontrada na API do Supabase. Execute o SQL em backend/db/migrations/002_logs_transferencias_schema.sql e tente novamente."
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

@app.post("/api/analista/transferir-massa")
async def transferir_pasta_massa(req: TransferirMassaRequest, authorization: Optional[str] = Header(default=None)):
    """Transfere múltiplas pastas de uma vez para o analista destino."""
    try:
        require_analyst_auth(authorization, expected_analyst_id=req.analista_origem_id)
        if int(req.analista_origem_id) == int(req.analista_destino_id):
            raise HTTPException(status_code=400, detail="Escolha outro analista para transferir")

        motivo_limpo = (req.motivo or "").strip()
        if not motivo_limpo:
            raise HTTPException(status_code=400, detail="Motivo da transferência é obrigatório")

        if not req.reserva_ids:
            raise HTTPException(status_code=400, detail="Nenhuma pasta selecionada")

        origem_res = supabase.table("analistas").select("id,nome").eq("id", req.analista_origem_id).execute()
        destino_res = supabase.table("analistas").select("*").eq("id", req.analista_destino_id).execute()

        if not destino_res.data:
            raise HTTPException(status_code=404, detail="Analista de destino não encontrado")

        destino = destino_res.data[0]
        if destino.get("status") != "ativo":
            raise HTTPException(status_code=400, detail="Analista de destino não está ativo")

        origem = origem_res.data[0] if origem_res.data else {"id": req.analista_origem_id, "nome": f"Analista {req.analista_origem_id}"}

        sucesso = []
        erros = []
        now = datetime.datetime.now().isoformat()

        for reserva_id in req.reserva_ids:
            try:
                dist = supabase.table("distribuicoes") \
                    .select("*") \
                    .eq("reserva_id", reserva_id) \
                    .eq("analista_id", req.analista_origem_id) \
                    .execute()

                if not dist.data:
                    erros.append({"reserva_id": reserva_id, "motivo": "Pasta não encontrada na mesa de origem"})
                    continue

                pasta = dist.data[0]
                situacao_id = int(pasta.get("situacao_id", 0))

                supabase.table("distribuicoes").update({
                    "analista_id": int(destino["id"]),
                    "data_atribuicao": now
                }).eq("reserva_id", reserva_id).execute()

                try:
                    supabase.table("logs_transferencias").insert({
                        "reserva_id": str(reserva_id),
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
                except Exception:
                    # Reverte a transferência desta pasta se o log falhar
                    supabase.table("distribuicoes").update({
                        "analista_id": int(req.analista_origem_id)
                    }).eq("reserva_id", reserva_id).execute()
                    erros.append({"reserva_id": reserva_id, "motivo": "Falha ao registrar log"})
                    continue

                sucesso.append(reserva_id)
            except Exception as e:
                erros.append({"reserva_id": reserva_id, "motivo": str(e)})

        if sucesso:
            supabase.table("analistas").update({
                "ultima_atribuicao": now,
                "total_hoje": build_next_total_hoje(destino, increment=len(sucesso))
            }).eq("id", destino["id"]).execute()

        return {
            "status": "ok",
            "transferidas": len(sucesso),
            "erros": len(erros),
            "detalhes_erros": erros
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/gestor/overview")
async def manager_overview(
    logs_limit: int = Query(default=200, ge=1, le=1000),
    logs_offset: int = Query(default=0, ge=0),
    authorization: Optional[str] = Header(default=None),
):
    require_manager_auth(authorization)
    # Usa os dados do último sync para não duplicar requests ao CVCRM
    now = datetime.datetime.now(datetime.timezone.utc)
    app_now = get_app_now(now)
    today_start = app_now.replace(hour=0, minute=0, second=0, microsecond=0)
    analytics_window_start = app_now - datetime.timedelta(days=365)
    total_crm = _LAST_SYNC_STATE.get("total_no_crm") or 0
    equipe = supabase.table("analistas").select("*").order("nome").execute().data or []
    equipe_normalizada: List[Dict[str, Any]] = []
    resumo_equipe_map: Dict[int, Dict[str, Any]] = {}

    for analista in equipe:
        analista_normalizado = dict(analista)
        total_hoje = get_effective_total_hoje(analista, reference=now)
        analista_normalizado["total_hoje"] = total_hoje
        equipe_normalizada.append(analista_normalizado)

        analista_id = analista.get("id")
        if analista_id is None:
            continue

        permissoes = [int(item) for item in (analista.get("permissoes") or []) if item is not None]
        resumo_equipe_map[int(analista_id)] = {
            "analista_id": int(analista_id),
            "nome": analista.get("nome") or f"Analista {analista_id}",
            "email": analista.get("email") or "",
            "status": analista.get("status") or "ativo",
            "is_online": bool(analista.get("is_online")),
            "recebidas_hoje": total_hoje,
            "feitas_hoje": 0,
            "na_mesa": 0,
            "ultima_atribuicao": analista.get("ultima_atribuicao"),
            "situacoes_ids": permissoes,
            "situacoes_nomes": [SITUACOES_NOMES.get(item, str(item)) for item in permissoes],
            "mesa_por_situacao": {},
            "analytics": {
                "total_periodo": 0,
                "por_dia": [],
                "por_mes": [],
                "por_situacao": [],
                "por_situacao_por_dia": [],
                "por_situacao_por_mes": [],
            },
        }

    distribuicao_atual = supabase.table("distribuicoes").select("*").execute().data or []
    historico_recente = supabase.table("historico").select("*").order("data_fim", desc=True).limit(100).execute().data or []
    atribuicoes_hoje_map: Dict[int, int] = {}

    for item in distribuicao_atual:
        analista_id = item.get("analista_id")
        if analista_id is None:
            continue

        assigned_at = parse_history_datetime(item.get("data_atribuicao"))
        if not assigned_at:
            continue

        if assigned_at.tzinfo is None:
            assigned_local = assigned_at.replace(tzinfo=datetime.timezone.utc).astimezone(APP_TIMEZONE)
        else:
            assigned_local = assigned_at.astimezone(APP_TIMEZONE)

        if assigned_local >= today_start:
            try:
                key = int(analista_id)
            except (TypeError, ValueError):
                continue
            atribuicoes_hoje_map[key] = atribuicoes_hoje_map.get(key, 0) + 1
    try:
        historico_hoje = (
            supabase.table("historico")
            .select("analista_id,situacao_id,situacao_nome,data_fim")
            .gte("data_fim", today_start.isoformat())
            .limit(10000)
            .execute()
            .data
            or []
        )
    except Exception:
        historico_hoje = []

    try:
        transferencias_hoje = (
            supabase.table("logs_transferencias")
            .select("analista_destino_id,data_transferencia")
            .gte("data_transferencia", today_start.astimezone(datetime.timezone.utc).isoformat())
            .limit(10000)
            .execute()
            .data
            or []
        )
    except Exception:
        transferencias_hoje = []

    transferencias_hoje_map: Dict[int, int] = {}
    for item in transferencias_hoje:
        analista_destino_id = item.get("analista_destino_id")
        if analista_destino_id is None:
            continue
        try:
            key = int(analista_destino_id)
        except (TypeError, ValueError):
            continue
        transferencias_hoje_map[key] = transferencias_hoje_map.get(key, 0) + 1

    try:
        historico_analytics = (
            supabase.table("historico")
            .select("analista_id,situacao_id,situacao_nome,data_fim")
            .gte("data_fim", analytics_window_start.astimezone(datetime.timezone.utc).isoformat())
            .limit(50000)
            .execute()
            .data
            or []
        )
    except Exception:
        historico_analytics = []

    analytics_map: Dict[int, Dict[str, Any]] = {}

    for item in historico_analytics:
        analista_id = item.get("analista_id")
        if analista_id is None:
            continue

        try:
            analista_key = int(analista_id)
        except (TypeError, ValueError):
            continue

        finished_at = parse_history_datetime(item.get("data_fim"))
        if not finished_at:
            continue

        if finished_at.tzinfo is None:
            finished_local = finished_at.replace(tzinfo=APP_TIMEZONE)
        else:
            finished_local = finished_at.astimezone(APP_TIMEZONE)

        bucket = analytics_map.setdefault(
            analista_key,
            {
                "por_dia": {},
                "por_mes": {},
                "por_situacao": {},
                "por_situacao_por_dia": {},
                "por_situacao_por_mes": {},
            },
        )

        day_key = finished_local.strftime("%Y-%m-%d")
        month_key = finished_local.strftime("%Y-%m")
        situacao_id = int(item.get("situacao_id") or 0)
        situacao_nome = item.get("situacao_nome") or SITUACOES_NOMES.get(situacao_id, "Nao informado")

        bucket["por_dia"][day_key] = bucket["por_dia"].get(day_key, 0) + 1
        bucket["por_mes"][month_key] = bucket["por_mes"].get(month_key, 0) + 1
        bucket["por_situacao"][situacao_nome] = bucket["por_situacao"].get(situacao_nome, 0) + 1

        situacao_dia_bucket = bucket["por_situacao_por_dia"].setdefault(situacao_nome, {})
        situacao_mes_bucket = bucket["por_situacao_por_mes"].setdefault(situacao_nome, {})
        situacao_dia_bucket[day_key] = situacao_dia_bucket.get(day_key, 0) + 1
        situacao_mes_bucket[month_key] = situacao_mes_bucket.get(month_key, 0) + 1

    for item in distribuicao_atual:
        analista_id = item.get("analista_id")
        if analista_id is None:
            continue
        resumo = resumo_equipe_map.get(int(analista_id))
        if not resumo:
            continue
        resumo["na_mesa"] += 1
        situacao_nome = item.get("situacao_nome") or SITUACOES_NOMES.get(int(item.get("situacao_id") or 0), "Não informado")
        resumo["mesa_por_situacao"][situacao_nome] = resumo["mesa_por_situacao"].get(situacao_nome, 0) + 1

    for item in historico_hoje:
        analista_id = item.get("analista_id")
        if analista_id is None:
            continue
        resumo = resumo_equipe_map.get(int(analista_id))
        if not resumo:
            continue
        resumo["feitas_hoje"] += 1

    for analista_id, resumo in resumo_equipe_map.items():
        raw_total = int(resumo.get("recebidas_hoje") or 0)
        atribuicoes_hoje = int(atribuicoes_hoje_map.get(analista_id) or 0)
        transferencias_hoje_total = int(transferencias_hoje_map.get(analista_id) or 0)

        # "Recebidas hoje" = pastas que entraram na fila do atendente no dia.
        entradas_na_fila_hoje = atribuicoes_hoje + transferencias_hoje_total
        if raw_total > entradas_na_fila_hoje + 20:
            resumo["recebidas_hoje"] = entradas_na_fila_hoje
        else:
            resumo["recebidas_hoje"] = max(raw_total, entradas_na_fila_hoje)

    for analista_id, resumo in resumo_equipe_map.items():
        analytics = analytics_map.get(analista_id) or {
            "por_dia": {},
            "por_mes": {},
            "por_situacao": {},
            "por_situacao_por_dia": {},
            "por_situacao_por_mes": {},
        }
        total_periodo = sum(analytics.get("por_dia", {}).values())

        top_situacoes = [
            label for label, _ in sorted(
                analytics.get("por_situacao", {}).items(),
                key=lambda item: (-item[1], item[0]),
            )[:10]
        ]

        por_situacao_por_dia = []
        por_situacao_por_mes = []

        for label in top_situacoes:
            daily_counter = analytics.get("por_situacao_por_dia", {}).get(label, {})
            monthly_counter = analytics.get("por_situacao_por_mes", {}).get(label, {})
            por_situacao_por_dia.append(
                {
                    "label": label,
                    "total": sum(daily_counter.values()),
                    "serie": build_daily_series(daily_counter, limit=30),
                }
            )
            por_situacao_por_mes.append(
                {
                    "label": label,
                    "total": sum(monthly_counter.values()),
                    "serie": build_monthly_series(monthly_counter, limit=12),
                }
            )

        resumo["analytics"] = {
            "total_periodo": total_periodo,
            "por_dia": build_daily_series(analytics.get("por_dia", {}), limit=30),
            "por_mes": build_monthly_series(analytics.get("por_mes", {}), limit=12),
            "por_situacao": build_sorted_counter(analytics.get("por_situacao", {}), limit=20),
            "por_situacao_por_dia": por_situacao_por_dia,
            "por_situacao_por_mes": por_situacao_por_mes,
        }

    resumo_equipe = sorted(
        resumo_equipe_map.values(),
        key=lambda item: (
            item["status"] != "ativo",
            not item["is_online"],
            -item["na_mesa"],
            -item["recebidas_hoje"],
            item["nome"].lower(),
        ),
    )

    try:
        logs_query = (
            supabase.table("logs_transferencias")
            .select("*", count="exact")
            .order("data_transferencia", desc=True)
            .range(logs_offset, logs_offset + logs_limit - 1)
            .execute()
        )
        logs_transferencias = logs_query.data or []
        logs_total = logs_query.count or 0
    except Exception:
        logs_transferencias = []
        logs_total = 0
    pastas_sem_destino = sum(1 for item in distribuicao_atual if not item.get("analista_id"))

    return {
        "equipe": equipe_normalizada,
        "resumo_equipe": resumo_equipe,
        "total_pendente_cvcrm": total_crm,
        "distribuicao_atual": distribuicao_atual,
        "historico_recente": historico_recente,
        "logs_transferencias": logs_transferencias,
        "logs_transferencias_total": logs_total,
        "logs_limit": logs_limit,
        "logs_offset": logs_offset,
        "pastas_sem_destino": pastas_sem_destino
    }

@app.post("/api/gestor/analistas")
async def create_analyst(req: AnalystCreate, authorization: Optional[str] = Header(default=None)):
    try:
        require_manager_auth(authorization)

        nome = (req.nome or "").strip()
        email = (req.email or "").strip().lower()
        senha = (req.senha or "").strip()
        status = (req.status or "ativo").strip().lower()
        permissoes = [int(p) for p in (req.permissoes or [])]

        if not nome:
            raise HTTPException(status_code=400, detail="Nome completo é obrigatório")
        if not email or "@" not in email:
            raise HTTPException(status_code=400, detail="E-mail de acesso inválido")
        if not senha:
            raise HTTPException(status_code=400, detail="Senha é obrigatória")
        if not permissoes:
            raise HTTPException(status_code=400, detail="Selecione pelo menos uma situação")
        if status not in {"ativo", "inativo"}:
            raise HTTPException(status_code=400, detail="Status inválido")

        insert_payload = {
            "nome": nome,
            "email": email,
            "senha": hash_password(senha),
            "permissoes": permissoes,
            "status": status,
            "is_online": False,
            "total_hoje": 0,
            "session_version": 1,
        }
        try:
            res = supabase.table("analistas").insert(insert_payload).execute()
        except Exception as insert_exc:
            if "session_version" in str(insert_exc):
                insert_payload.pop("session_version", None)
                res = supabase.table("analistas").insert(insert_payload).execute()
            else:
                raise
        return res.data[0]
    except HTTPException:
        raise
    except APIError as e:
        if e.args and "23505" in str(e):
            raise HTTPException(status_code=409, detail="E-mail já cadastrado para outro analista")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/api/gestor/analistas/{id}")
async def update_analyst(id: int, req: AnalystUpdate, authorization: Optional[str] = Header(default=None)):
    try:
        require_manager_auth(authorization)
        data = {k: v for k, v in req.dict().items() if v is not None}
        password_changed = False

        if "nome" in data:
            data["nome"] = str(data["nome"] or "").strip()
            if not data["nome"]:
                raise HTTPException(status_code=400, detail="Nome completo é obrigatório")

        if "email" in data:
            data["email"] = str(data["email"] or "").strip().lower()
            if not data["email"] or "@" not in data["email"]:
                raise HTTPException(status_code=400, detail="E-mail de acesso inválido")

        if "senha" in data:
            senha_limpa = str(data["senha"] or "").strip()
            if senha_limpa:
                data["senha"] = hash_password(senha_limpa)
                password_changed = True
            else:
                data.pop("senha")

        if "permissoes" in data and not data["permissoes"]:
            raise HTTPException(status_code=400, detail="Selecione pelo menos uma situação")

        if "status" in data:
            data["status"] = str(data["status"] or "").strip().lower()
            if data["status"] not in {"ativo", "inativo"}:
                raise HTTPException(status_code=400, detail="Status inválido")
            if data["status"] == "inativo":
                data["is_online"] = False

        if not data:
            raise HTTPException(status_code=400, detail="Nenhum campo válido para atualizar")

        res = supabase.table("analistas").update(data).eq("id", id).execute()

        if password_changed:
            bump_session_version("analyst", int(id))

        return res.data[0]
    except HTTPException:
        raise
    except APIError as e:
        if e.args and "23505" in str(e):
            raise HTTPException(status_code=409, detail="E-mail já cadastrado para outro analista")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/gestor/analistas/{id}")
async def delete_analyst(id: int, authorization: Optional[str] = Header(default=None)):
    try:
        require_manager_auth(authorization)
        supabase.table("analistas").delete().eq("id", id).execute()
        return {"status": "removido"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
