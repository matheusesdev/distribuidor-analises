import asyncio, datetime
import requests as _requests
from typing import Any, Dict, List, Optional
from app_core.db import CRM_SOURCES, SITUACOES_IDS, SITUACOES_META, SITUACOES_NOMES, _LAST_SYNC_STATE, _SYNC_LOCK, supabase, HISTORICO_HAS_ANALISTA_NOME, HISTORICO_HAS_SITUACAO_ID, HISTORICO_HAS_SITUACAO_NOME
from app_core.logging_setup import logger
from app_core.text_utils import decode_json_response, normalize_text_value
from domain.analysts import build_next_total_hoje, get_next_analyst


def build_reserva_key(source, external_reserva_id):
    n = str(external_reserva_id or "").strip()
    if not n: return ""
    return n if source == "cvcrm" else f"{source}:{n}"


def parse_reserva_key(reserva_key):
    n = str(reserva_key or "").strip()
    if not n: return {"source": "cvcrm", "external_id": ""}
    if ":" in n:
        prefix, external = n.split(":", 1)
        if prefix in CRM_SOURCES and external: return {"source": prefix, "external_id": external}
    return {"source": "cvcrm", "external_id": n}


def extract_reservas_from_response(data):
    total_pages = 1
    if isinstance(data, list):
        return [(str(i.get("idreserva") or i.get("id") or idx), i) for idx, i in enumerate(data)], total_pages
    if isinstance(data, dict):
        for wk in ("data", "reservas", "items", "result", "results"):
            if wk in data and isinstance(data[wk], list):
                meta = data.get("meta") or data.get("pagination") or data.get("paginator") or {}
                if isinstance(meta, dict):
                    lp = meta.get("last_page") or meta.get("totalPages") or meta.get("total_pages")
                    if lp: total_pages = int(lp)
                return [(str(i.get("idreserva") or i.get("id") or idx), i) for idx, i in enumerate(data[wk])], total_pages
        pairs = []
        for key, value in data.items():
            if isinstance(value, dict):
                pairs.append((str(value.get("idreserva") or value.get("id") or key).strip(), value))
        return pairs, total_pages
    return [], total_pages


async def fetch_cvcrm_reservas(sit_id, timeout_seconds, pagina=1):
    meta = SITUACOES_META.get(int(sit_id) if sit_id is not None else -1)
    if not meta: raise RuntimeError(f"Situacao nao mapeada: {sit_id}")
    source_key = str(meta.get("source") or "cvcrm")
    source_cfg = CRM_SOURCES.get(source_key)
    if not source_cfg or not source_cfg.get("enabled"): raise RuntimeError(f"Fonte indisponivel: {source_key}")
    external_id = int(meta.get("external_id") or sit_id)
    url = f"{source_cfg['api_base_url']}?situacao={external_id}&pagina={pagina}"
    headers = {"email": source_cfg["email"], "token": source_cfg["token"], "accept": "application/json"}
    return await asyncio.to_thread(_requests.get, url, headers=headers, timeout=timeout_seconds)


async def fetch_all_reservas_for_situacao(sit_id):
    meta = SITUACOES_META.get(int(sit_id) if sit_id is not None else -1)
    if not meta: raise RuntimeError(f"Situacao nao mapeada: {sit_id}")
    source_key = str(meta.get("source") or "cvcrm")
    source_cfg = CRM_SOURCES.get(source_key)
    if not source_cfg or not source_cfg.get("enabled"): return []
    external_id = int(meta.get("external_id") or sit_id)
    all_pairs = []; page = 1
    while True:
        try:
            response = await fetch_cvcrm_reservas(sit_id, timeout_seconds=15, pagina=page)
        except Exception as exc:
            raise RuntimeError(f"Falha CVCRM sit {sit_id} pag {page}: {exc}") from exc
        if response.status_code == 204: break
        if response.status_code != 200:
            raise RuntimeError(f"CVCRM HTTP {response.status_code} sit {external_id} pag {page}")
        try:
            data = normalize_text_value(decode_json_response(response))
        except Exception as exc:
            raise RuntimeError(f"JSON invalido CVCRM sit {sit_id} pag {page}") from exc
        pairs, total_pages = extract_reservas_from_response(data)
        logger.info("[SYNC] Fonte %s sit %s pag %s/%s: %s reservas", source_key, external_id, page, total_pages, len(pairs))
        all_pairs.extend(pairs)
        if page >= total_pages or not pairs: break
        page += 1
    result = []
    for res_id, info in all_pairs:
        if not res_id or res_id == "None": continue
        entry = dict(info)
        entry["_reserva_id_externo"] = res_id
        entry["_reserva_id_normalizado"] = build_reserva_key(source_key, res_id)
        entry["_reserva_source"] = source_key
        entry["_situacao_id_externo"] = external_id
        result.append(entry)
    return result


def build_analista_nome_lookup():
    try:
        analistas = supabase.table("analistas").select("id,nome").execute().data or []
    except: return {}
    return {int(a["id"]): (a.get("nome") or "").strip() for a in analistas if a.get("id") is not None}


async def build_situacao_lookup():
    from domain.suggestions import is_missing_transfer_logs_table_error
    lookup = {}
    try:
        for item in supabase.table("distribuicoes").select("reserva_id,situacao_id,situacao_nome").execute().data or []:
            rid = str(item.get("reserva_id") or "").strip()
            if rid: lookup[rid] = {"situacao_id": item.get("situacao_id"), "situacao_nome": normalize_text_value(item.get("situacao_nome")) or SITUACOES_NOMES.get(int(item.get("situacao_id") or 0), "Nao informado"), "source": "distribuicoes"}
    except: pass
    try:
        for item in supabase.table("logs_transferencias").select("reserva_id,situacao_id,situacao_nome,data_transferencia").order("data_transferencia", desc=True).limit(10000).execute().data or []:
            rid = str(item.get("reserva_id") or "").strip()
            if rid and rid not in lookup: lookup[rid] = {"situacao_id": item.get("situacao_id"), "situacao_nome": normalize_text_value(item.get("situacao_nome")) or SITUACOES_NOMES.get(int(item.get("situacao_id") or 0), "Nao informado"), "source": "logs_transferencias"}
    except Exception as exc:
        if not is_missing_transfer_logs_table_error(str(exc)): raise
    for sit_id in SITUACOES_IDS:
        try:
            for info in await fetch_all_reservas_for_situacao(sit_id):
                rid = str(info.get("_reserva_id_normalizado") or "").strip()
                if rid and rid not in lookup: lookup[rid] = {"situacao_id": sit_id, "situacao_nome": normalize_text_value(info.get("situacao_nome")) or SITUACOES_NOMES.get(sit_id, "Nao informado"), "source": "cvcrm"}
        except: continue
    return lookup


async def backfill_historico_metadata(limit=5000):
    rows = supabase.table("historico").select("id,reserva_id,analista_id,analista_nome,situacao_id,situacao_nome,data_fim").order("data_fim", desc=True).limit(limit).execute().data or []
    candidates = [r for r in rows if (HISTORICO_HAS_SITUACAO_ID and r.get("situacao_id") is None) or (HISTORICO_HAS_SITUACAO_NOME and not (r.get("situacao_nome") or "").strip()) or (HISTORICO_HAS_ANALISTA_NOME and not (r.get("analista_nome") or "").strip())]
    sl = await build_situacao_lookup() if (HISTORICO_HAS_SITUACAO_ID or HISTORICO_HAS_SITUACAO_NOME) else {}
    al = build_analista_nome_lookup() if HISTORICO_HAS_ANALISTA_NOME else {}
    updated = 0; unresolved = []; sb = {}
    for row in candidates:
        payload = {}
        rid = str(row.get("reserva_id") or "").strip()
        si = sl.get(rid) if rid else None
        if si:
            if HISTORICO_HAS_SITUACAO_ID and row.get("situacao_id") is None and si.get("situacao_id") is not None: payload["situacao_id"] = si["situacao_id"]
            if HISTORICO_HAS_SITUACAO_NOME and not (row.get("situacao_nome") or "").strip() and si.get("situacao_nome"): payload["situacao_nome"] = si["situacao_nome"]
        aid = row.get("analista_id")
        if HISTORICO_HAS_ANALISTA_NOME and not (row.get("analista_nome") or "").strip() and aid is not None:
            nome = al.get(int(aid))
            if nome: payload["analista_nome"] = nome
        if not payload:
            if rid: unresolved.append(rid)
            continue
        supabase.table("historico").update(payload).eq("id", row["id"]).execute()
        updated += 1
        if "situacao_id" in payload or "situacao_nome" in payload:
            src = (si or {}).get("source", "desconhecido"); sb[src] = sb.get(src, 0) + 1
    return {"status": "ok", "analisados": len(rows), "candidatos": len(candidates), "atualizados": updated, "nao_encontrados": len(unresolved), "fontes_situacao": sb, "exemplos_nao_encontrados": unresolved[:20]}


async def perform_sync():
    async with _SYNC_LOCK:
        ids_no_crm = set(); erros = []; por_situacao = {}; situacoes_ok = set(); mon = set(); falharam = []; ignoradas = []; removidas = 0; aplicada = False; escopo = "nenhuma"
        inicio = datetime.datetime.now(datetime.timezone.utc)
        for sit_id in SITUACOES_IDS:
            meta = SITUACOES_META.get(int(sit_id), {}); nome = SITUACOES_NOMES.get(sit_id, str(sit_id)); src_key = str(meta.get("source") or "cvcrm"); src_cfg = CRM_SOURCES.get(src_key) or {}
            if not src_cfg.get("enabled"):
                por_situacao[nome] = 0; ignoradas.append({"situacao_id": sit_id, "situacao_nome": nome, "fonte": src_key}); continue
            mon.add(int(sit_id))
            try:
                reservas = await fetch_all_reservas_for_situacao(sit_id)
                por_situacao[nome] = len(reservas); situacoes_ok.add(int(sit_id))
                logger.info("[SYNC] Sit %s (%s): %s reservas", nome, sit_id, len(reservas))
                for info in reservas:
                    res_id = str(info.get("_reserva_id_normalizado") or "").strip()
                    if not res_id or res_id == "None": continue
                    ids_no_crm.add(res_id)
                    try:
                        ativa = supabase.table("distribuicoes").select("*").eq("reserva_id", res_id).execute()
                        now = datetime.datetime.now().isoformat()
                        if not ativa.data:
                            analista = await get_next_analyst(sit_id)
                            titular = info.get("titular") or {}; unidade_info = info.get("unidade") or {}
                            supabase.table("distribuicoes").upsert({"reserva_id": res_id, "cliente": titular.get("nome", "Desconhecido") if isinstance(titular, dict) else "Desconhecido", "empreendimento": unidade_info.get("empreendimento", "N/A") if isinstance(unidade_info, dict) else "N/A", "unidade": unidade_info.get("unidade", "N/A") if isinstance(unidade_info, dict) else "N/A", "situacao_id": sit_id, "situacao_nome": SITUACOES_NOMES.get(sit_id, "Geral"), "analista_id": analista["id"] if analista else None, "data_atribuicao": now if analista else None}, on_conflict="reserva_id", ignore_duplicates=True).execute()
                            if analista: supabase.table("analistas").update({"ultima_atribuicao": now, "total_hoje": build_next_total_hoje(analista)}).eq("id", analista["id"]).execute()
                        else:
                            db = ativa.data[0]; aid = db.get("analista_id"); deve = not aid
                            if aid:
                                ar = supabase.table("analistas").select("*").eq("id", aid).execute()
                                if not ar.data: deve = True
                                else:
                                    a = ar.data[0]
                                    if a.get("status") != "ativo" or not a.get("is_online"): deve = True
                            if deve:
                                prox = await get_next_analyst(sit_id, exclude_ids=[aid] if aid else None)
                                if prox: supabase.table("distribuicoes").update({"analista_id": prox["id"], "data_atribuicao": now, "situacao_id": sit_id, "situacao_nome": SITUACOES_NOMES.get(sit_id, "Geral")}).eq("reserva_id", res_id).execute(); supabase.table("analistas").update({"ultima_atribuicao": now, "total_hoje": build_next_total_hoje(prox)}).eq("id", prox["id"]).execute()
                                else: supabase.table("distribuicoes").update({"analista_id": None, "data_atribuicao": None, "situacao_id": sit_id, "situacao_nome": SITUACOES_NOMES.get(sit_id, "Geral")}).eq("reserva_id", res_id).execute()
                            if int(db.get("situacao_id") or 0) != int(sit_id): supabase.table("distribuicoes").update({"situacao_id": sit_id, "situacao_nome": SITUACOES_NOMES.get(sit_id, "Geral")}).eq("reserva_id", res_id).execute()
                    except Exception as ie: msg = f"Reserva {res_id} (sit {sit_id}): {ie}"; logger.error("[SYNC][ERRO] %s", msg); erros.append(msg)
            except Exception as se: msg = f"Sit {nome} ({sit_id}): {se}"; logger.error("[SYNC][ERRO] %s", msg); erros.append(msg); por_situacao[nome] = -1; falharam.append({"situacao_id": sit_id, "situacao_nome": nome, "fonte": src_key})
        try:
            locais = supabase.table("distribuicoes").select("reserva_id,situacao_id").execute().data or []
            if locais and situacoes_ok:
                aplicada = True; escopo = "parcial" if (falharam or ignoradas) else "total"
                for reg in locais:
                    rid_l = str(reg.get("reserva_id") or "").strip()
                    if not rid_l: continue
                    try: sit_l = int(reg.get("situacao_id") or 0)
                    except: sit_l = 0
                    if sit_l and sit_l not in mon: continue
                    if falharam and sit_l not in situacoes_ok: continue
                    if rid_l not in ids_no_crm: supabase.table("distribuicoes").delete().eq("reserva_id", rid_l).execute(); removidas += 1
            else: escopo = "ignorada"
        except Exception as re_err: erros.append(f"Remocao: {re_err}")
        fim = datetime.datetime.now(datetime.timezone.utc)
        _LAST_SYNC_STATE.update({"timestamp": fim.isoformat(), "total_no_crm": len(ids_no_crm), "por_situacao": por_situacao, "erros": erros[-50:], "duracao_segundos": round((fim - inicio).total_seconds(), 2), "situacoes_falharam": falharam, "situacoes_ignoradas": ignoradas, "limpeza_aplicada": aplicada, "limpeza_escopo": escopo, "removidas_na_limpeza": removidas})
        if erros: logger.warning("[SYNC] Concluido com %s erros. CRM: %s. Limpeza: %s, removidas: %s", len(erros), len(ids_no_crm), escopo, removidas)
        else: logger.info("[SYNC] OK - %s reservas, %ss. Limpeza: %s, removidas: %s", len(ids_no_crm), _LAST_SYNC_STATE['duracao_segundos'], escopo, removidas)