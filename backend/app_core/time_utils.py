import datetime
from typing import Optional
from app_core.config import APP_TIMEZONE


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
