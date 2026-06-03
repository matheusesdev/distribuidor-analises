import asyncio
from typing import Any, Dict, List

from postgrest.exceptions import APIError
from supabase import Client, create_client

from app_core.config import (
    CVCRM_BASE_URL, CVCRM_EMAIL, CVCRM_LOTEAR_BASE_URL,
    CVCRM_LOTEAR_TOKEN, CVCRM_TOKEN, SUPABASE_KEY, SUPABASE_URL,
)
from app_core.logging_setup import logger
from app_core.text_utils import fix_text

try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    logger.info("[OK] Conexao com Supabase estabelecida.")
except Exception as e:
    logger.error("[ERRO] Erro ao ligar ao Supabase: %s", e)
    supabase = None  # type: ignore[assignment]


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

CRM_SOURCES: Dict[str, Dict[str, Any]] = {
    "cvcrm": {"name": "CVCRM", "api_base_url": CVCRM_BASE_URL, "gestor_base_url": "https://vca.cvcrm.com.br/gestor/comercial/reservas", "email": CVCRM_EMAIL, "token": CVCRM_TOKEN, "enabled": True},
    "lotear": {"name": "CVCRM LOTEAR", "api_base_url": CVCRM_LOTEAR_BASE_URL, "gestor_base_url": "https://vcalotear.cvcrm.com.br/gestor/comercial/reservas", "email": CVCRM_EMAIL, "token": CVCRM_LOTEAR_TOKEN, "enabled": bool(CVCRM_LOTEAR_TOKEN)},
}

SITUACOES_DEFINITIONS: List[Dict[str, Any]] = [
    {"id": 62, "external_id": 62, "source": "cvcrm", "nome": "ANALISE VENDA LOTEAMENTO"},
    {"id": 63, "external_id": 63, "source": "cvcrm", "nome": "APROVACAO FINANCEIRA"},
    {"id": 66, "external_id": 66, "source": "cvcrm", "nome": "ANALISE VENDA PARCELAMENTO INCORPORADORA"},
    {"id": 30, "external_id": 30, "source": "cvcrm", "nome": "ANALISE VENDA CAIXA"},
    {"id": 16, "external_id": 16, "source": "cvcrm", "nome": "CONFECCAO DE CONTRATO"},
    {"id": 15, "external_id": 15, "source": "lotear", "nome": "APROVACAO FINANCEIRA (LOTEAR)"},
    {"id": 31, "external_id": 31, "source": "cvcrm", "nome": "ASSINADO"},
    {"id": 84, "external_id": 84, "source": "cvcrm", "nome": "APROVACAO EXPANSAO"},
    {"id": 1012, "external_id": 12, "source": "lotear", "nome": "ANALISE VENDA LOTEAMENTO (LOTEAR)"},
    {"id": 1023, "external_id": 23, "source": "lotear", "nome": "APROVACAO EXPANSAO (LOTEAR)"},
    {"id": 1016, "external_id": 16, "source": "lotear", "nome": "CONFECCAO DE CONTRATO (LOTEAR)"},
    {"id": 1021, "external_id": 21, "source": "lotear", "nome": "ASSINADO (LOTEAR)"},
]

SITUACOES_NOMES: Dict[int, str] = {item["id"]: fix_text(item["nome"]) for item in SITUACOES_DEFINITIONS}
SITUACOES_IDS: List[int] = [item["id"] for item in SITUACOES_DEFINITIONS]
SITUACOES_META: Dict[int, Dict[str, Any]] = {item["id"]: item for item in SITUACOES_DEFINITIONS}

SUGGESTION_STATUS_FLOW: List[str] = ["Em desenvolvimento", "Em Planejamento", "Em analise", "Aprovado", "Aguardando Cliente", "Concluido"]
SUGGESTION_STATUS_SET: set = set(SUGGESTION_STATUS_FLOW)

_LAST_SYNC_STATE: Dict[str, Any] = {"timestamp": None, "total_no_crm": 0, "por_situacao": {}, "erros": [], "duracao_segundos": None}
_SYNC_LOCK = asyncio.Lock()
