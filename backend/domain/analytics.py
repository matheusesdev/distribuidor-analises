import datetime
from typing import Any, Dict, List, Optional

def build_sorted_counter(counter_map: Dict[str, int], *, limit: Optional[int] = None) -> List[Dict[str, Any]]:
    items = [{"label": l, "total": t} for l, t in counter_map.items()]
    items.sort(key=lambda i: (-i["total"], i["label"]))
    return items[:limit] if limit is not None else items

def build_daily_series(counter_map: Dict[str, int], *, limit: int = 14) -> List[Dict[str, Any]]:
    keys = sorted(counter_map.keys())[-limit:]
    return [{"key": k, "label": datetime.datetime.strptime(k, "%Y-%m-%d").strftime("%d/%m"), "total": counter_map[k]} for k in keys]

def build_monthly_series(counter_map: Dict[str, int], *, limit: int = 12) -> List[Dict[str, Any]]:
    keys = sorted(counter_map.keys())[-limit:]
    return [{"key": k, "label": datetime.datetime.strptime(f"{k}-01", "%Y-%m-%d").strftime("%m/%Y"), "total": counter_map[k]} for k in keys]
