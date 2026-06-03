from typing import Any, Dict, Optional
from app_core.db import SITUACOES_NOMES, SUGGESTION_STATUS_SET
from app_core.text_utils import fix_text

SUGGESTION_STATUS_ALIASES = {"Em analise": "Em analise", "Concluido": "Concluido"}

def coerce_suggestion_status(raw_status):
    normalized = fix_text((raw_status or "").strip())
    return SUGGESTION_STATUS_ALIASES.get(normalized, normalized)

def normalize_suggestion_status(raw_status):
    normalized = coerce_suggestion_status(raw_status)
    return normalized if normalized in SUGGESTION_STATUS_SET else "Em analise"

def build_transfer_log_payload(*, reserva_id, origem, destino, pasta, situacao_id, motivo, data_transferencia):
    return {"reserva_id": str(reserva_id), "analista_origem_id": int(origem.get("id")), "analista_origem_nome": origem.get("nome"), "analista_destino_id": int(destino.get("id")), "analista_destino_nome": destino.get("nome"), "situacao_id": situacao_id, "situacao_nome": pasta.get("situacao_nome") or SITUACOES_NOMES.get(situacao_id, "Geral"), "cliente": pasta.get("cliente"), "empreendimento": pasta.get("empreendimento"), "unidade": pasta.get("unidade"), "motivo": motivo, "data_transferencia": data_transferencia}

def is_missing_transfer_logs_table_error(error_message):
    return "logs_transferencias" in error_message and any(k in error_message for k in ("does not exist", "42P01", "PGRST205", "schema cache"))

def is_missing_suggestions_table_error(error_message):
    return "sugestoes_melhoria" in error_message and any(k in error_message for k in ("does not exist", "42P01", "PGRST205", "schema cache"))

def is_missing_suggestions_column_error(error_message, column_name):
    msg = (error_message or "").lower()
    col = (column_name or "").lower()
    return "sugestoes_melhoria" in msg and col in msg and any(k in msg for k in ("column", "schema cache", "pgrst204", "pgrst205"))