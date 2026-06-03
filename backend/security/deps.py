from typing import Any, Dict, Optional
from fastapi import HTTPException
from security.tokens import verify_analyst_token, verify_manager_token

def require_manager_auth(authorization: Optional[str]) -> Dict[str, Any]:
    if not authorization:
        raise HTTPException(status_code=401, detail="Acesso restrito. Faca login no painel admin.")
    scheme, _, token = authorization.partition(" ")
    payload = verify_manager_token(token) if scheme.lower() == "bearer" else None
    if not payload:
        raise HTTPException(status_code=401, detail="Sessao do admin invalida ou expirada.")
    return payload

def require_analyst_auth(authorization: Optional[str], expected_analyst_id: Optional[int] = None) -> Dict[str, Any]:
    if not authorization:
        raise HTTPException(status_code=401, detail="Sessao do analista ausente. Faca login novamente.")
    scheme, _, token = authorization.partition(" ")
    payload = verify_analyst_token(token) if scheme.lower() == "bearer" else None
    if not payload:
        raise HTTPException(status_code=401, detail="Sessao do analista invalida ou expirada.")
    if expected_analyst_id is not None and int(payload.get("user_id")) != int(expected_analyst_id):
        raise HTTPException(status_code=403, detail="Token do analista nao autorizado para este usuario.")
    return payload

def require_authenticated_user(authorization: Optional[str]) -> Dict[str, Any]:
    if not authorization:
        raise HTTPException(status_code=401, detail="Autenticacao obrigatoria.")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="Token de autenticacao invalido.")
    mp = verify_manager_token(token)
    if mp: return mp
    ap = verify_analyst_token(token)
    if ap: return ap
    raise HTTPException(status_code=401, detail="Sessao invalida ou expirada.")
