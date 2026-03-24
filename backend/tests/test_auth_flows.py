def seed_analysts(app_module):
    active_hash = app_module.hash_password("Senha@123")
    inactive_hash = app_module.hash_password("Senha@456")
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
    assert len(payload) == 2
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
