import datetime
from typing import Optional
from fastapi import APIRouter, Header, HTTPException
from app_core.db import supabase, HISTORICO_HAS_SITUACAO_ID, HISTORICO_HAS_SITUACAO_NOME, HISTORICO_HAS_ANALISTA_NOME, SITUACOES_NOMES
from app_core.time_utils import parse_history_datetime
from domain.analysts import build_queue_counts_by_analyst, enrich_mesa_with_transfer_metadata, reconcile_analyst_mesa_against_current_permissions, get_effective_total_hoje
from domain.analytics import build_daily_series, build_monthly_series, build_sorted_counter
from security.deps import require_analyst_auth, require_authenticated_user
from security.sessions import serialize_analyst_public

router = APIRouter()

@router.get("/api/analistas")
async def listar_analistas(authorization: Optional[str] = Header(default=None)):
    try:
        require_authenticated_user(authorization)
        queue_counts = build_queue_counts_by_analyst()
        res = supabase.table("analistas").select("id,nome,email,permissoes,status,is_online,total_hoje,ultima_atribuicao").order("nome").execute()
        return [serialize_analyst_public({**item, "na_mesa": queue_counts.get(int(item.get("id") or 0), 0)}) for item in (res.data or [])]
    except HTTPException: raise
    except: return []

@router.get("/api/mesa/{analista_id}")
async def get_mesa(analista_id: int, authorization: Optional[str] = Header(default=None)):
    require_analyst_auth(authorization, expected_analyst_id=analista_id)
    await reconcile_analyst_mesa_against_current_permissions(analista_id)
    res = supabase.table("distribuicoes").select("*").eq("analista_id", analista_id).execute()
    return enrich_mesa_with_transfer_metadata(res.data or [])

@router.get("/api/metricas/{analista_id}")
async def get_metrics(analista_id: int, authorization: Optional[str] = Header(default=None)):
    require_analyst_auth(authorization, expected_analyst_id=analista_id)
    now = datetime.datetime.now()
    def count_period(since):
        q = supabase.table("historico").select("id", count="exact").eq("analista_id", analista_id).gte("data_fim", since).execute()
        return q.count or 0
    return {"hoje": count_period(now.strftime("%Y-%m-%d")), "ano": count_period(now.strftime("%Y-01-01"))}

@router.get("/api/analista/dashboard/{analista_id}")
async def get_analyst_dashboard(analista_id: int, authorization: Optional[str] = Header(default=None)):
    require_analyst_auth(authorization, expected_analyst_id=analista_id)
    fields = ["reserva_id", "cliente", "empreendimento", "unidade", "resultado", "data_fim"]
    if HISTORICO_HAS_SITUACAO_ID: fields.append("situacao_id")
    if HISTORICO_HAS_SITUACAO_NOME: fields.append("situacao_nome")
    try:
        history_response = supabase.table("historico").select(",".join(fields), count="exact").eq("analista_id", analista_id).order("data_fim", desc=True).limit(5000).execute()
    except Exception as e: raise HTTPException(status_code=500, detail=f"Erro ao carregar dashboard: {e}")
    raw_rows = history_response.data or []
    now = datetime.datetime.now(); today = now.date(); current_month = today.strftime("%Y-%m"); current_year = today.strftime("%Y")
    por_dia = {}; por_mes = {}; por_resultado = {}; por_situacao = {}; por_empreendimento = {}; normalized_rows = []
    total_hoje = 0; total_mes = 0; total_ano = 0
    for row in raw_rows:
        finished_at = parse_history_datetime(row.get("data_fim"))
        if not finished_at: continue
        fl = finished_at.astimezone() if finished_at.tzinfo else finished_at
        dk = fl.strftime("%Y-%m-%d"); mk = fl.strftime("%Y-%m"); yk = fl.strftime("%Y")
        por_dia[dk] = por_dia.get(dk, 0) + 1; por_mes[mk] = por_mes.get(mk, 0) + 1
        resultado = (row.get("resultado") or "Sem resultado").strip(); empreendimento = (row.get("empreendimento") or "Nao informado").strip()
        sn = ""
        if HISTORICO_HAS_SITUACAO_NOME: sn = (row.get("situacao_nome") or "").strip()
        if not sn and HISTORICO_HAS_SITUACAO_ID: sn = SITUACOES_NOMES.get(int(row.get("situacao_id") or 0), "")
        por_resultado[resultado] = por_resultado.get(resultado, 0) + 1
        if sn: por_situacao[sn] = por_situacao.get(sn, 0) + 1
        por_empreendimento[empreendimento] = por_empreendimento.get(empreendimento, 0) + 1
        if fl.date() == today: total_hoje += 1
        if mk == current_month: total_mes += 1
        if yk == current_year: total_ano += 1
        normalized_rows.append({"reserva_id": row.get("reserva_id"), "cliente": row.get("cliente") or "Nao informado", "empreendimento": empreendimento, "unidade": row.get("unidade") or "Nao informado", "situacao_nome": sn or "Nao informado", "resultado": resultado, "data_fim": fl.isoformat(), "data_fim_label": fl.strftime("%d/%m/%Y %H:%M")})
    dpd = len(por_dia); media = round(len(normalized_rows) / dpd, 2) if dpd else 0
    return {"resumo": {"total": len(normalized_rows), "hoje": total_hoje, "mes": total_mes, "ano": total_ano, "media_por_dia": media, "dias_com_producao": dpd}, "series": {"por_dia": build_daily_series(por_dia, limit=14), "por_mes": build_monthly_series(por_mes, limit=12)}, "rankings": {"por_resultado": build_sorted_counter(por_resultado), "por_situacao": build_sorted_counter(por_situacao), "por_empreendimento": build_sorted_counter(por_empreendimento, limit=10)}, "schema": {"historico_tem_analista_nome": HISTORICO_HAS_ANALISTA_NOME, "historico_tem_situacao": HISTORICO_HAS_SITUACAO_ID or HISTORICO_HAS_SITUACAO_NOME}, "registros": normalized_rows, "total_registros": history_response.count or len(normalized_rows), "gerado_em": now.isoformat()}