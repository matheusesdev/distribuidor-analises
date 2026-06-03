import os
import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from typing import List


def load_dotenv(dotenv_path: str = ".env") -> None:
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
    origins = [origin.strip().rstrip("/") for origin in raw.split(",") if origin.strip()]
    if "*" in origins:
        raise RuntimeError("ALLOWED_ORIGINS não pode conter '*' quando allow_credentials está habilitado")
    deduplicated: List[str] = []
    for origin in origins:
        if origin and origin not in deduplicated:
            deduplicated.append(origin)
    return deduplicated or ["http://localhost:5173"]


def parse_bool_env(name: str, default: bool = False) -> bool:
    raw_value = (os.getenv(name) or "").strip().lower()
    if not raw_value:
        return default
    return raw_value in {"1", "true", "yes", "on", "y", "sim"}


# Carrega .env uma única vez ao importar o módulo
_env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(_env_path)

ALLOWED_ORIGINS = parse_allowed_origins(os.getenv("ALLOWED_ORIGINS", "http://localhost:5173"))
SYNC_INTERVAL_SECONDS = int(os.getenv("SYNC_INTERVAL_SECONDS", "60"))
PORT = int(os.getenv("PORT", "8000"))
TESTING = parse_bool_env("TESTING", default=False)

SUPABASE_URL = get_required_env("SUPABASE_URL")
SUPABASE_KEY = get_required_env("SUPABASE_KEY")
CVCRM_EMAIL = get_required_env("CVCRM_EMAIL")
CVCRM_TOKEN = get_required_env("CVCRM_TOKEN")
CVCRM_BASE_URL = (os.getenv("CVCRM_BASE_URL") or "https://vca.cvcrm.com.br/api/v1/comercial/reservas").strip()
CVCRM_LOTEAR_BASE_URL = (os.getenv("CVCRM_LOTEAR_BASE_URL") or "https://vcalotear.cvcrm.com.br/api/v1/comercial/reservas").strip()
CVCRM_LOTEAR_TOKEN = (os.getenv("CVCRM_LOTEAR_TOKEN") or "").strip()
ADMIN_AUTH_SECRET = get_required_env("ADMIN_AUTH_SECRET")
if len(ADMIN_AUTH_SECRET) < 32:
    raise RuntimeError("ADMIN_AUTH_SECRET deve ter ao menos 32 caracteres")
MANAGER_TOKEN_TTL_SECONDS = int(os.getenv("MANAGER_TOKEN_TTL_SECONDS", "1800"))
ANALYST_AUTH_SECRET = (os.getenv("ANALYST_AUTH_SECRET") or ADMIN_AUTH_SECRET).strip()
ANALYST_TOKEN_TTL_SECONDS = int(os.getenv("ANALYST_TOKEN_TTL_SECONDS", "43200"))
APP_TIMEZONE_NAME = (os.getenv("APP_TIMEZONE") or "America/Sao_Paulo").strip() or "America/Sao_Paulo"

try:
    APP_TIMEZONE = ZoneInfo(APP_TIMEZONE_NAME)
except ZoneInfoNotFoundError:
    APP_TIMEZONE = datetime.timezone.utc
    APP_TIMEZONE_NAME = "UTC"

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
