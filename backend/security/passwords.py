import base64, binascii, hashlib, hmac, os
from typing import Any, Dict

def hash_password(plain_password: str, iterations: int = 310000) -> str:
    salt = os.urandom(16)
    ph = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt, iterations)
    return f"pbkdf2_sha256${iterations}${base64.b64encode(salt).decode()}${base64.b64encode(ph).decode()}"

def verify_password(plain_password: str, stored_password: str) -> bool:
    if not stored_password or not stored_password.startswith("pbkdf2_sha256$"):
        return False
    try:
        _, iterations, salt_b64, hash_b64 = stored_password.split("$", 3)
        salt = base64.b64decode(salt_b64.encode("ascii"))
        expected_hash = base64.b64decode(hash_b64.encode("ascii"))
        calculated_hash = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt, int(iterations))
        return hmac.compare_digest(calculated_hash, expected_hash)
    except (ValueError, binascii.Error):
        return False

def evaluate_password_strength(password: str) -> Dict[str, Any]:
    p = (password or "").strip()
    checks = [len(p) >= 8, len(p) >= 12, any(c.islower() for c in p) and any(c.isupper() for c in p), any(c.isdigit() for c in p), any(not c.isalnum() for c in p)]
    score = sum(checks)
    if score <= 2: return {"level": "weak", "label": "Muito fraca", "is_acceptable": False}
    if score == 3: return {"level": "medium", "label": "Media", "is_acceptable": True}
    if score == 4: return {"level": "strong", "label": "Forte", "is_acceptable": True}
    return {"level": "verystrong", "label": "Muito forte", "is_acceptable": True}
