def seed_analysts(app_module):
    active_hash = app_module.hash_password("Senha@123")
    inactive_hash = app_module.hash_password("Senha@456")
    reviewer_hash = app_module.hash_password("Senha@789")
    app_module.supabase.db["analistas"] = [
        {
            "id": 1,
            "nome": "Ana Ativa",
            "email": "ana@teste.com",
            "senha": active_hash,
            "permissoes": [62, 31],
            "status": "ativo",
            "is_online": True,
            "total_hoje": 3,
            "ultima_atribuicao": "2026-03-24T10:00:00",
            "session_version": 1,
        },
        {
            "id": 2,
            "nome": "Igor Inativo",
            "email": "igor@teste.com",
            "senha": inactive_hash,
            "permissoes": [62],
            "status": "inativo",
            "is_online": False,
            "total_hoje": 0,
            "ultima_atribuicao": None,
            "session_version": 1,
        },
        {
            "id": 3,
            "nome": "Bruno Revisor",
            "email": "bruno@teste.com",
            "senha": reviewer_hash,
            "permissoes": [62, 31],
            "status": "ativo",
            "is_online": True,
            "total_hoje": 1,
            "ultima_atribuicao": "2026-03-24T09:00:00",
            "session_version": 1,
        },
    ]


def auth_header(app_module, analyst_id=1):
    analyst = next(item for item in app_module.supabase.db["analistas"] if item["id"] == analyst_id)
    token = app_module.create_analyst_token(analyst)
    return {"Authorization": f"Bearer {token}"}


def test_login_email_hides_sensitive_fields(client, app_module):
    seed_analysts(app_module)

    response = client.post("/api/login/email", json={"email": "ana@teste.com", "senha": "Senha@123"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["id"] == 1
    assert payload["nome"] == "Ana Ativa"
    assert payload["email"] == "ana@teste.com"
    assert "token" in payload
    assert "senha" not in payload
    assert "session_version" not in payload


def test_login_by_id_blocks_inactive_analyst(client, app_module):
    seed_analysts(app_module)

    response = client.post("/api/login", json={"analista_id": 2, "senha": "Senha@456"})

    assert response.status_code == 403
    assert "Conta desativada" in response.json()["detail"]


def test_list_analysts_requires_auth_and_returns_sanitized_data(client, app_module):
    seed_analysts(app_module)

    unauthorized = client.get("/api/analistas")
    assert unauthorized.status_code == 401

    authorized = client.get("/api/analistas", headers=auth_header(app_module))
    assert authorized.status_code == 200
    payload = authorized.json()
    assert len(payload) == 3
    assert "senha" not in payload[0]
    assert set(payload[0].keys()) == {
        "id",
        "nome",
        "email",
        "permissoes",
        "status",
        "is_online",
        "total_hoje",
        "ultima_atribuicao",
    }


def test_concluir_only_allows_owner_of_reserva(client, app_module):
    seed_analysts(app_module)
    app_module.supabase.db["distribuicoes"] = [
        {
            "reserva_id": "res-1",
            "cliente": "Cliente 1",
            "empreendimento": "Emp 1",
            "unidade": "Apto 1",
            "situacao_id": 62,
            "situacao_nome": "ANÁLISE VENDA LOTEAMENTO",
            "analista_id": 1,
            "data_atribuicao": "2026-03-24T10:00:00",
        }
    ]

    forbidden = client.post(
        "/api/concluir",
        params={"reserva_id": "res-1", "resultado": "aprovado"},
        headers=auth_header(app_module, analyst_id=2),
    )
    assert forbidden.status_code == 401

    allowed = client.post(
        "/api/concluir",
        params={"reserva_id": "res-1", "resultado": "aprovado"},
        headers=auth_header(app_module, analyst_id=1),
    )
    assert allowed.status_code == 200
    assert allowed.json()["status"] == "ok"
    assert app_module.supabase.db["distribuicoes"] == []
    assert len(app_module.supabase.db["historico"]) == 1
    assert app_module.supabase.db["historico"][0]["reserva_id"] == "res-1"


def test_transferir_moves_reserva_and_logs_transfer(client, app_module):
    seed_analysts(app_module)
    app_module.supabase.db["distribuicoes"] = [
        {
            "reserva_id": "res-2",
            "cliente": "Cliente 2",
            "empreendimento": "Emp 2",
            "unidade": "Apto 2",
            "situacao_id": 62,
            "situacao_nome": "ANÁLISE VENDA LOTEAMENTO",
            "analista_id": 1,
            "data_atribuicao": "2026-03-24T10:00:00",
        }
    ]

    response = client.post(
        "/api/analista/transferir",
        json={
            "reserva_id": "res-2",
            "analista_origem_id": 1,
            "analista_destino_id": 3,
            "motivo": "Balanceamento de fila",
        },
        headers=auth_header(app_module, analyst_id=1),
    )

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert app_module.supabase.db["distribuicoes"][0]["analista_id"] == 3
    assert len(app_module.supabase.db["logs_transferencias"]) == 1
    assert app_module.supabase.db["logs_transferencias"][0]["reserva_id"] == "res-2"


def test_forgot_password_sets_reset_token_fields(client, app_module, monkeypatch):
    seed_analysts(app_module)
    monkeypatch.setattr(app_module, "generate_reset_token", lambda: ("plain-reset-token", "hashed-reset-token"))
    monkeypatch.setattr(app_module, "send_reset_email", lambda **kwargs: True)

    response = client.post("/api/analista/esqueceu-senha", json={"email": "ana@teste.com"})

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    analyst = next(item for item in app_module.supabase.db["analistas"] if item["id"] == 1)
    assert analyst["reset_token_hash"] == "hashed-reset-token"
    assert analyst["reset_token_expires"]


def test_reset_password_updates_hash_and_clears_token(client, app_module):
    seed_analysts(app_module)
    token = "plain-reset-token"
    token_hash = app_module.hashlib.sha256(token.encode("utf-8")).hexdigest()
    analyst = next(item for item in app_module.supabase.db["analistas"] if item["id"] == 1)
    analyst["reset_token_hash"] = token_hash
    analyst["reset_token_expires"] = "2999-03-24T10:00:00+00:00"

    response = client.post(
        "/api/analista/resetar-senha",
        json={"token": token, "nova_senha": "NovaSenha@123"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert analyst["reset_token_hash"] is None
    assert analyst["reset_token_expires"] is None
    assert analyst["session_version"] == 2
    assert app_module.verify_password("NovaSenha@123", analyst["senha"])


def test_status_fila_offline_redistributes_owned_items(client, app_module):
    seed_analysts(app_module)
    app_module.supabase.db["distribuicoes"] = [
        {
            "reserva_id": "res-3",
            "cliente": "Cliente 3",
            "empreendimento": "Emp 3",
            "unidade": "Apto 3",
            "situacao_id": 62,
            "situacao_nome": "ANÁLISE VENDA LOTEAMENTO",
            "analista_id": 1,
            "data_atribuicao": "2026-03-24T10:00:00",
        }
    ]

    response = client.post(
        "/api/analista/status-fila",
        json={"analista_id": 1, "online": False},
        headers=auth_header(app_module, analyst_id=1),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["redistribuidas"] == 1
    assert payload["sem_destino"] == 0
    assert app_module.supabase.db["distribuicoes"][0]["analista_id"] == 3
