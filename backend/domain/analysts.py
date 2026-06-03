import datetime
from typing import Any, Dict, List, Optional
from app_core.db import supabase
from app_core.logging_setup import logger
from app_core.time_utils import get_local_today, parse_history_datetime
from security.passwords import hash_password, verify_password

def build_queue_counts_by_analyst():
    distribuicoes = supabase.table("distribuicoes").select("analista_id").execute().data or []
    counts = {}
    for item in distribuicoes:
        aid = item.get("analista_id")
        if aid is not None: counts[int(aid)] = counts.get(int(aid), 0) + 1
    return counts

def enrich_mesa_with_transfer_metadata(mesa_items):
    rids = [str(i.get("reserva_id")) for i in mesa_items if i.get("reserva_id") is not None]
    if not rids: return mesa_items
    latest = {}
    try:
        logs = supabase.table("logs_transferencias").select("id,reserva_id,analista_origem_id,analista_origem_nome,motivo,data_transferencia").in_("reserva_id", rids).order("data_transferencia", desc=True).execute().data or []
    except: logs = []
    for log in logs:
        rid = str(log.get("reserva_id") or "")
        if rid and rid not in latest:
            latest[rid] = {"id": log.get("id"), "reserva_id": rid, "analista_origem_id": log.get("analista_origem_id"), "analista_origem_nome": log.get("analista_origem_nome"), "motivo": log.get("motivo"), "data_transferencia": log.get("data_transferencia")}
    result = []
    for item in mesa_items:
        enriched = dict(item)
        t = latest.get(str(item.get("reserva_id") or ""))
        if t: enriched["transferencia_manual"] = t
        result.append(enriched)
    return result

def ensure_analyst_online_on_login(analyst):
    aid = int(analyst.get("id") or 0)
    if not aid or bool(analyst.get("is_online")): return analyst
    try:
        updated = supabase.table("analistas").update({"is_online": True}).eq("id", aid).execute().data or []
        if updated: return updated[0]
    except: pass
    return {**analyst, "is_online": True}

def validate_analyst_password(analyst_id, received_password, stored_password):
    nr = (received_password or "").strip()
    ns = (stored_password or "").strip()
    if verify_password(nr, ns): return True
    if nr == ns:
        supabase.table("analistas").update({"senha": hash_password(nr)}).eq("id", analyst_id).execute()
        return True
    return False

def get_effective_total_hoje(analyst, reference=None):
    reference_dt = reference or datetime.datetime.now(datetime.timezone.utc)
    ua = parse_history_datetime(str(analyst.get("ultima_atribuicao") or ""))
    if not ua: return 0
    last_day = ua.replace(tzinfo=datetime.timezone.utc).astimezone().date() if ua.tzinfo is None else ua.astimezone().date()
    if last_day != get_local_today(reference_dt): return 0
    return int(analyst.get("total_hoje") or 0)

def build_next_total_hoje(analyst, increment=1, reference=None):
    return get_effective_total_hoje(analyst, reference=reference) + increment

def sort_analysts_for_queue(analysts, reference=None):
    rdt = reference or datetime.datetime.now(datetime.timezone.utc)
    def sort_key(a):
        th = get_effective_total_hoje(a, reference=rdt)
        ua = parse_history_datetime(str(a.get("ultima_atribuicao") or ""))
        if ua is None: lk = datetime.datetime.min.replace(tzinfo=datetime.timezone.utc)
        elif ua.tzinfo is None: lk = ua.replace(tzinfo=datetime.timezone.utc)
        else: lk = ua.astimezone(datetime.timezone.utc)
        return (th, lk, (a.get("nome") or "").lower())
    return sorted(analysts, key=sort_key)

async def get_next_analyst(sit_id, exclude_ids=None):
    try:
        exclude_ids = exclude_ids or []
        response = supabase.table("analistas").select("*").eq("status", "ativo").eq("is_online", True).execute()
        if not response.data: return None
        for analista in sort_analysts_for_queue(response.data):
            if int(analista.get("id")) in [int(x) for x in exclude_ids]: continue
            if int(sit_id) in [int(p) for p in (analista.get("permissoes") or [])]: return analista
    except Exception as e:
        logger.error("Erro na fila de analistas: %s", e)
    return None

async def reconcile_analyst_mesa(analyst_id, *, allowed_situations=None, force_reassign_all=False):
    mesa = supabase.table("distribuicoes").select("reserva_id,situacao_id").eq("analista_id", analyst_id).execute()
    itens_mesa = mesa.data or []
    redistribuidas = 0; sem_destino = 0
    allowed_set = {int(i) for i in (allowed_situations or []) if i is not None}
    for item in itens_mesa:
        sit_id = int(item.get("situacao_id") or 0)
        if not force_reassign_all and sit_id in allowed_set: continue
        proximo = await get_next_analyst(sit_id, exclude_ids=[analyst_id])
        now = datetime.datetime.now().isoformat()
        if not proximo:
            supabase.table("distribuicoes").update({"analista_id": None, "data_atribuicao": None}).eq("reserva_id", item["reserva_id"]).execute()
            sem_destino += 1
        else:
            supabase.table("distribuicoes").update({"analista_id": proximo["id"], "data_atribuicao": now}).eq("reserva_id", item["reserva_id"]).execute()
            supabase.table("analistas").update({"ultima_atribuicao": now, "total_hoje": build_next_total_hoje(proximo)}).eq("id", proximo["id"]).execute()
            redistribuidas += 1
    return {"redistribuidas": redistribuidas, "sem_destino": sem_destino}

async def reconcile_analyst_mesa_against_current_permissions(analyst_id):
    resp = supabase.table("analistas").select("permissoes,status").eq("id", analyst_id).limit(1).execute()
    if not resp.data: return {"redistribuidas": 0, "sem_destino": 0}
    analyst = resp.data[0]
    status = str(analyst.get("status") or "ativo").strip().lower()
    permissions = [int(i) for i in (analyst.get("permissoes") or []) if i is not None]
    return await reconcile_analyst_mesa(analyst_id, allowed_situations=permissions, force_reassign_all=status == "inativo")