import re
import json
from typing import Any, List, Optional

import requests as _requests

try:
    from ftfy import fix_text
except ModuleNotFoundError:
    def fix_text(value: str) -> str:
        return value


REPLACEMENT_CHAR_FIXES = (
    ("GUSM�O", "GUSMÃO"),
    ("JO�O", "JOÃO"),
    ("S�O", "SÃO"),
    ("JOS�", "JOSÉ"),
    ("ANT�NIO", "ANTÔNIO"),
    ("CONCEI��O", "CONCEIÇÃO"),
    ("GON�ALVES", "GONÇALVES"),
    ("ARA�AJO", "ARAÚJO"),
    ("ARA�UJO", "ARAÚJO"),
    ("M�RCIA", "MÁRCIA"),
    ("M�RIO", "MÁRIO"),
    ("CL�AUDIA", "CLÁUDIA"),
)

REPLACEMENT_CHAR_REGEX_FIXES = (
    (re.compile(r"APROVA[◆�]+O\s+FINANCEIRA\s*\(LOTEAR\)", re.IGNORECASE), "APROVAÇÃO FINANCEIRA (LOTEAR)"),
    (re.compile(r"APROVA[◆�]+O\s+FINANCEIRA", re.IGNORECASE), "APROVAÇÃO FINANCEIRA"),
    (re.compile(r"APROVA[◆�]+O\s+EXPANS(?:ÃO|[◆�]+O)\s*\(LOTEAR\)", re.IGNORECASE), "APROVAÇÃO EXPANSÃO (LOTEAR)"),
    (re.compile(r"APROVA[◆�]+O\s+EXPANS(?:ÃO|[◆�]+O)", re.IGNORECASE), "APROVAÇÃO EXPANSÃO"),
)


def repair_replacement_chars(value: str) -> str:
    result = value
    for broken, fixed in REPLACEMENT_CHAR_FIXES:
        result = result.replace(broken, fixed)
        result = result.replace(broken.lower(), fixed.lower())
        result = result.replace(broken.title(), fixed.title())
    for pattern, fixed in REPLACEMENT_CHAR_REGEX_FIXES:
        result = pattern.sub(fixed, result)
    return result


def normalize_text_value(value: Any) -> Any:
    if isinstance(value, str):
        return repair_replacement_chars(fix_text(value))
    if isinstance(value, list):
        return [normalize_text_value(item) for item in value]
    if isinstance(value, dict):
        return {
            normalize_text_value(key) if isinstance(key, str) else key: normalize_text_value(item)
            for key, item in value.items()
        }
    return value


def decode_json_response(response: _requests.Response) -> Any:
    raw_body = response.content
    candidates: List[str] = []

    for encoding in ("utf-8", "cp1252", "latin-1"):
        try:
            candidates.append(raw_body.decode(encoding))
        except UnicodeDecodeError:
            continue

    if response.text:
        candidates.append(response.text)

    candidates = sorted(
        dict.fromkeys(candidates),
        key=lambda text: (text.count("�"), text.count("?"), len(text)),
    )

    last_error: Optional[Exception] = None
    for candidate in candidates:
        try:
            return json.loads(candidate)
        except Exception as exc:
            last_error = exc

    if last_error:
        raise last_error
    return response.json()
