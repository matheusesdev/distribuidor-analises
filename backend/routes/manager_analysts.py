from typing import Optional
from fastapi import APIRouter, Header, HTTPException
from postgrest.exceptions import APIError
from app_core.db import supabase
from domain.analysts import reconcile_analyst_mesa
from domain.models import AnalystCreate, AnalystUpdate
from security.deps import require_manager_auth
from security.passwords import hash_password
from security.sessions import bump_session_version, serialize_analyst_public

router = APIRouter()

@router.post("/api/gestor/analistas")
async def create_analyst(req: AnalystCreate, authorization: Optional[str] = Header(default=None)):
    try:
        require_manager_auth(authorization)
        nome = (req.nome or "").strip(); email = (req.email or "").strip().lower(); senha = (req.senha or "").strip()
        status = (req.status or "ativo").strip().lower(); permissoes = [int(p) for p in (req.permissoes or [])]
        if not nome: raise HTTPException(status_code=400, detail="Nome completo e obrigatorio")
        if not email or "@" not in email: raise HTTPException(status_code=400, detail="E-mail de acesso invalido")
        if not senha: raise HTTPException(status_code=400, detail="Senha e obrigatoria")
        if not permissoes: raise HTTPException(status_code=400, detail="Selecione pelo menos uma situacao")
        if status not in {"ativo", "inativo"}: raise HTTPException(status_code=400, detail="Status invalido")
        insert_payload = {"nome": nome, "email": email, "senha": hash_password(senha), "permissoes": permissoes, "status": status, "is_online": False, "total_hoje": 0, "session_version": 1}
        try:
            res = supabase.table("analistas").insert(insert_payload).execute()
        except Exception as exc:
            if "session_version" in str(exc):
                insert_payload.pop("session_version", None)
                res = supabase.table("analistas").insert(insert_payload).execute()
            else: raise
        return serialize_analyst_public(res.data[0])
    except HTTPException: raise
    except APIError as e:
        if e.args and "23505" in str(e): raise HTTPException(status_code=409, detail="E-mail ja cadastrado para outro analista")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@router.patch("/api/gestor/analistas/{id}")
async def update_analyst(id: int, req: AnalystUpdate, authorization: Optional[str] = Header(default=None)):
    try:
        require_manager_auth(authorization)
        data = {k: v for k, v in req.dict().items() if v is not None}
        password_changed = False
        current_response = supabase.table("analistas").select("permissoes,status").eq("id", id).limit(1).execute()
        if not current_response.data: raise HTTPException(status_code=404, detail="Analista nao encontrado")
        current_analyst = current_response.data[0]
        current_permissions = [int(i) for i in (current_analyst.get("permissoes") or []) if i is not None]
        current_status = str(current_analyst.get("status") or "ativo").strip().lower()
        if "nome" in data:
            data["nome"] = str(data["nome"] or "").strip()
            if not data["nome"]: raise HTTPException(status_code=400, detail="Nome completo e obrigatorio")
        if "email" in data:
            data["email"] = str(data["email"] or "").strip().lower()
            if not data["email"] or "@" not in data["email"]: raise HTTPException(status_code=400, detail="E-mail de acesso invalido")
        if "senha" in data:
            senha_limpa = str(data["senha"] or "").strip()
            if senha_limpa: data["senha"] = hash_password(senha_limpa); password_changed = True
            else: data.pop("senha")
        if "permissoes" in data and not data["permissoes"]: raise HTTPException(status_code=400, detail="Selecione pelo menos uma situacao")
        if "status" in data:
            data["status"] = str(data["status"] or "").strip().lower()
            if data["status"] not in {"ativo", "inativo"}: raise HTTPException(status_code=400, detail="Status invalido")
            if data["status"] == "inativo": data["is_online"] = False
        updated_permissions = current_permissions
        permissions_changed = False
        if "permissoes" in data:
            updated_permissions = [int(i) for i in (data.get("permissoes") or []) if i is not None]
            permissions_changed = set(updated_permissions) != set(current_permissions)
        if not data: raise HTTPException(status_code=400, detail="Nenhum campo valido para atualizar")
        res = supabase.table("analistas").update(data).eq("id", id).execute()
        updated_status = str(data.get("status", current_status) or current_status).strip().lower()
        if permissions_changed or updated_status == "inativo":
            await reconcile_analyst_mesa(id, allowed_situations=updated_permissions, force_reassign_all=updated_status == "inativo")
        if password_changed:
            bump_session_version("analyst", int(id))
        return serialize_analyst_public(res.data[0])
    except HTTPException: raise
    except APIError as e:
        if e.args and "23505" in str(e): raise HTTPException(status_code=409, detail="E-mail ja cadastrado para outro analista")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@router.delete("/api/gestor/analistas/{id}")
async def delete_analyst(id: int, authorization: Optional[str] = Header(default=None)):
    try:
        require_manager_auth(authorization)
        supabase.table("analistas").delete().eq("id", id).execute()
        return {"status": "removido"}
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))