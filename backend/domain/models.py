from typing import List, Optional
from pydantic import BaseModel

class LoginRequest(BaseModel):
    analista_id: int
    senha: str

class LoginEmailRequest(BaseModel):
    email: str
    senha: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    nova_senha: str

class ManagerLoginRequest(BaseModel):
    usuario: str
    senha: str

class AdminCreateRequest(BaseModel):
    email: str
    senha: str
    username: Optional[str] = None
    ativo: bool = True

class SessionRevokeRequest(BaseModel):
    role: str
    user_id: int
    reason: Optional[str] = None

class AnalystCreate(BaseModel):
    nome: str
    email: str
    senha: str
    permissoes: List[int]
    status: str = "ativo"

class AnalystUpdate(BaseModel):
    nome: Optional[str] = None
    email: Optional[str] = None
    senha: Optional[str] = None
    permissoes: Optional[List[int]] = None
    status: Optional[str] = None

class StatusFilaRequest(BaseModel):
    analista_id: int
    online: bool

class TransferirPastaRequest(BaseModel):
    reserva_id: str
    analista_origem_id: int
    analista_destino_id: int
    motivo: str

class TransferirMassaRequest(BaseModel):
    reserva_ids: List[str]
    analista_origem_id: int
    analista_destino_id: int
    motivo: str

class ChangePasswordRequest(BaseModel):
    analista_id: int
    senha_atual: str
    nova_senha: str

class SuggestionCreateRequest(BaseModel):
    titulo: str
    detalhes: str

class SuggestionStatusUpdateRequest(BaseModel):
    status: str

class SuggestionUpdateRequest(BaseModel):
    titulo: Optional[str] = None
    detalhes: Optional[str] = None

class SuggestionAdminResponseRequest(BaseModel):
    resposta: str