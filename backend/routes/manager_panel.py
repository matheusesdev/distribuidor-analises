from typing import Optional
from fastapi import APIRouter, Header, HTTPException, Query
from app_core.db import _LAST_SYNC_STATE, supabase, SITUACOES_NOMES
from app_core.time_utils import get_app_now, parse_history_datetime
from domain.analytics import build_daily_series, build_monthly_series, build_sorted_counter
from domain.sync import backfill_historico_metadata, perform_sync
from security.deps import require_manager_auth
import datetime

router = APIRouter()

@router.get("/api/gestor/sync-status")
async def sync_status(authorization: Optional[str] = Header(default=None)):
    require_manager_auth(authorization)
    mesa_count = 0
    try:
        mesa_count = len(supabase.table("distribuicoes").select("reserva_id").execute().data or [])
    except Exception: pass
    return {**_LAST_SYNC_STATE, "total_na_mesa_local": mesa_count, "situacoes_monitoradas": SITUACOES_NOMES}

@router.get("/api/gestor/debug/cvcrm")
async def debug_cvcrm_response(sit_id: int = Query(...), pagina: int = Query(default=1, ge=1), authorization: Optional[str] = Header(default=None)):
    require_manager_auth(authorization)
    from domain.sync import extract_reservas_from_response, fetch_cvcrm_reservas
    from app_core.text_utils import decode_json_response, normalize_text_value
    try:
        response = await fetch_cvcrm_reservas(sit_id, timeout_seconds=15, pagina=pagina)
        if response.status_code != 200:
            return {"status_code": response.status_code, "situacao_id": sit_id, "pagina": pagina, "conteudo_bruto": response.text[:500]}
        data = normalize_text_value(decode_json_response(response))
        pairs, total_pages = extract_reservas_from_response(data)
        return {"status_code": response.status_code, "situacao_id": sit_id, "pagina": pagina, "total_paginas_detectadas": total_pages, "tipo_resposta": type(data).__name__, "chaves_raiz": list(data.keys()) if isinstance(data, dict) else None, "total_reservas_nesta_pagina": len(pairs), "campos_primeiro_item": list(pairs[0][1].keys()) if pairs and isinstance(pairs[0][1], dict) else None}
    except Exception as exc: raise HTTPException(status_code=500, detail=str(exc))

@router.post("/api/gestor/redistribuir")
async def redistribute_all(authorization: Optional[str] = Header(default=None)):
    try:
        require_manager_auth(authorization)
        supabase.table("distribuicoes").delete().neq("reserva_id", "0").execute()
        await perform_sync()
        return {"status": "sucesso"}
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/gestor/zerar-dados")
async def reset_all_data(authorization: Optional[str] = Header(default=None)):
    try:
        require_manager_auth(authorization)
        supabase.table("distribuicoes").delete().neq("reserva_id", "0").execute()
        supabase.table("analistas").update({"total_hoje": 0, "ultima_atribuicao": None}).neq("id", 0).execute()
        return {"status": "ok", "message": "Mesa limpa e ordem de distribuicao reiniciada"}
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/gestor/historico/backfill")
async def backfill_historico(limit: int = Query(default=5000, ge=1, le=20000), authorization: Optional[str] = Header(default=None)):
    require_manager_auth(authorization)
    return await backfill_historico_metadata(limit=limit)

@router.get("/api/gestor/overview")
async def manager_overview(logs_limit: int = Query(default=200, ge=1, le=1000), logs_offset: int = Query(default=0, ge=0), authorization: Optional[str] = Header(default=None)):
    require_manager_auth(authorization)
    from app_core.db import HISTORICO_HAS_SITUACAO_ID, HISTORICO_HAS_SITUACAO_NOME
    from app_core.config import APP_TIMEZONE
    now = datetime.datetime.now(datetime.timezone.utc)
    app_now = get_app_now(now)
    today_start = app_now.replace(hour=0, minute=0, second=0, microsecond=0)
    analytics_window_start = app_now - datetime.timedelta(days=365)
    total_crm = _LAST_SYNC_STATE.get("total_no_crm") or 0
    equipe = supabase.table("analistas").select("*").order("nome").execute().data or []
    from domain.analysts import get_effective_total_hoje
    equipe_normalizada = []
    resumo_equipe_map = {}
    for analista in equipe:
        an = dict(analista)
        total_hoje = get_effective_total_hoje(analista, reference=now)
        an["total_hoje"] = total_hoje
        equipe_normalizada.append(an)
        aid = analista.get("id")
        if aid is None: continue
        permissoes = [int(i) for i in (analista.get("permissoes") or []) if i is not None]
        resumo_equipe_map[int(aid)] = {"analista_id": int(aid), "nome": analista.get("nome") or f"Analista {aid}", "email": analista.get("email") or "", "status": analista.get("status") or "ativo", "is_online": bool(analista.get("is_online")), "recebidas_hoje": total_hoje, "feitas_hoje": 0, "na_mesa": 0, "ultima_atribuicao": analista.get("ultima_atribuicao"), "situacoes_ids": permissoes, "situacoes_nomes": [SITUACOES_NOMES.get(i, str(i)) for i in permissoes], "mesa_por_situacao": {}, "analytics": {"total_periodo": 0, "por_dia": [], "por_mes": [], "por_situacao": [], "por_situacao_por_dia": [], "por_situacao_por_mes": []}}
    distribuicao_atual = supabase.table("distribuicoes").select("*").execute().data or []
    historico_recente = supabase.table("historico").select("*").order("data_fim", desc=True).limit(100).execute().data or []
    atribuicoes_hoje_map = {}
    for item in distribuicao_atual:
        aid = item.get("analista_id")
        if aid is None: continue
        assigned_at = parse_history_datetime(item.get("data_atribuicao"))
        if not assigned_at: continue
        assigned_local = assigned_at.replace(tzinfo=datetime.timezone.utc).astimezone(APP_TIMEZONE) if assigned_at.tzinfo is None else assigned_at.astimezone(APP_TIMEZONE)
        if assigned_local >= today_start:
            try: key = int(aid); atribuicoes_hoje_map[key] = atribuicoes_hoje_map.get(key, 0) + 1
            except: pass
    try: historico_hoje = supabase.table("historico").select("analista_id,situacao_id,situacao_nome,data_fim").gte("data_fim", today_start.isoformat()).limit(10000).execute().data or []
    except: historico_hoje = []
    try: transferencias_hoje = supabase.table("logs_transferencias").select("analista_destino_id,data_transferencia").gte("data_transferencia", today_start.astimezone(datetime.timezone.utc).isoformat()).limit(10000).execute().data or []
    except: transferencias_hoje = []
    transferencias_hoje_map = {}
    for item in transferencias_hoje:
        adid = item.get("analista_destino_id")
        if adid is None: continue
        try: key = int(adid); transferencias_hoje_map[key] = transferencias_hoje_map.get(key, 0) + 1
        except: pass
    try: historico_analytics = supabase.table("historico").select("analista_id,situacao_id,situacao_nome,data_fim").gte("data_fim", analytics_window_start.astimezone(datetime.timezone.utc).isoformat()).limit(50000).execute().data or []
    except: historico_analytics = []
    analytics_map = {}
    for item in historico_analytics:
        aid = item.get("analista_id")
        if aid is None: continue
        try: akey = int(aid)
        except: continue
        finished_at = parse_history_datetime(item.get("data_fim"))
        if not finished_at: continue
        finished_local = finished_at.replace(tzinfo=APP_TIMEZONE).astimezone(APP_TIMEZONE) if finished_at.tzinfo is None else finished_at.astimezone(APP_TIMEZONE)
        bucket = analytics_map.setdefault(akey, {"por_dia": {}, "por_mes": {}, "por_situacao": {}, "por_situacao_por_dia": {}, "por_situacao_por_mes": {}})
        dk = finished_local.strftime("%Y-%m-%d"); mk = finished_local.strftime("%Y-%m")
        sid = int(item.get("situacao_id") or 0); sn = item.get("situacao_nome") or SITUACOES_NOMES.get(sid, "Nao informado")
        bucket["por_dia"][dk] = bucket["por_dia"].get(dk, 0) + 1
        bucket["por_mes"][mk] = bucket["por_mes"].get(mk, 0) + 1
        bucket["por_situacao"][sn] = bucket["por_situacao"].get(sn, 0) + 1
        bucket["por_situacao_por_dia"].setdefault(sn, {})[dk] = bucket["por_situacao_por_dia"].setdefault(sn, {}).get(dk, 0) + 1
        bucket["por_situacao_por_mes"].setdefault(sn, {})[mk] = bucket["por_situacao_por_mes"].setdefault(sn, {}).get(mk, 0) + 1
    for item in distribuicao_atual:
        aid = item.get("analista_id")
        if aid is None: continue
        resumo = resumo_equipe_map.get(int(aid))
        if not resumo: continue
        resumo["na_mesa"] += 1
        sn = item.get("situacao_nome") or SITUACOES_NOMES.get(int(item.get("situacao_id") or 0), "Nao informado")
        resumo["mesa_por_situacao"][sn] = resumo["mesa_por_situacao"].get(sn, 0) + 1
    for item in historico_hoje:
        aid = item.get("analista_id")
        if aid is not None:
            resumo = resumo_equipe_map.get(int(aid))
            if resumo: resumo["feitas_hoje"] += 1
    for aid, resumo in resumo_equipe_map.items():
        raw_total = int(resumo.get("recebidas_hoje") or 0)
        atribuicoes_hoje = int(atribuicoes_hoje_map.get(aid) or 0)
        transf_hoje = int(transferencias_hoje_map.get(aid) or 0)
        entradas = atribuicoes_hoje + transf_hoje
        resumo["recebidas_hoje"] = entradas if raw_total > entradas + 20 else max(raw_total, entradas)
    for aid, resumo in resumo_equipe_map.items():
        analytics = analytics_map.get(aid) or {"por_dia": {}, "por_mes": {}, "por_situacao": {}, "por_situacao_por_dia": {}, "por_situacao_por_mes": {}}
        total_periodo = sum(analytics.get("por_dia", {}).values())
        top_sit = [l for l, _ in sorted(analytics.get("por_situacao", {}).items(), key=lambda x: (-x[1], x[0]))[:10]]
        por_sit_dia = [{"label": l, "total": sum(analytics.get("por_situacao_por_dia", {}).get(l, {}).values()), "serie": build_daily_series(analytics.get("por_situacao_por_dia", {}).get(l, {}), limit=30)} for l in top_sit]
        por_sit_mes = [{"label": l, "total": sum(analytics.get("por_situacao_por_mes", {}).get(l, {}).values()), "serie": build_monthly_series(analytics.get("por_situacao_por_mes", {}).get(l, {}), limit=12)} for l in top_sit]
        resumo["analytics"] = {"total_periodo": total_periodo, "por_dia": build_daily_series(analytics.get("por_dia", {}), limit=30), "por_mes": build_monthly_series(analytics.get("por_mes", {}), limit=12), "por_situacao": build_sorted_counter(analytics.get("por_situacao", {}), limit=20), "por_situacao_por_dia": por_sit_dia, "por_situacao_por_mes": por_sit_mes}
    resumo_equipe = sorted(resumo_equipe_map.values(), key=lambda i: (i["status"] != "ativo", not i["is_online"], -i["na_mesa"], -i["recebidas_hoje"], i["nome"].lower()))
    try:
        logs_query = supabase.table("logs_transferencias").select("*", count="exact").order("data_transferencia", desc=True).range(logs_offset, logs_offset + logs_limit - 1).execute()
        logs_transferencias = logs_query.data or []; logs_total = logs_query.count or 0
    except: logs_transferencias = []; logs_total = 0
    pastas_sem_destino = sum(1 for i in distribuicao_atual if not i.get("analista_id"))
    return {"equipe": equipe_normalizada, "resumo_equipe": resumo_equipe, "total_pendente_cvcrm": total_crm, "distribuicao_atual": distribuicao_atual, "historico_recente": historico_recente, "logs_transferencias": logs_transferencias, "logs_transferencias_total": logs_total, "logs_limit": logs_limit, "logs_offset": logs_offset, "pastas_sem_destino": pastas_sem_destino}