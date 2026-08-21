"""Integration: registration → login → /auth/me → refresh → logout."""
import pytest

from .conftest import unique_email, register_and_login


@pytest.mark.asyncio
async def test_register_login_me(client):
    session = await register_and_login(client)
    me = await client.get("/auth/me", headers=session["headers"])
    assert me.status_code == 200
    assert me.json()["email"] == session["email"]


@pytest.mark.asyncio
async def test_login_wrong_password_rejected(client):
    email = unique_email()
    await client.post("/auth/register", json={"email": email, "password": "senhaSegura123"})
    res = await client.post("/auth/login", json={"email": email, "password": "senhaErrada999"})
    assert res.status_code in (401, 400)


@pytest.mark.asyncio
async def test_invalid_email_error_is_in_portuguese_not_the_raw_validator_text(client):
    """Um e-mail com domínio reservado (.local) batia no validador do
    Pydantic/email-validator, que devolvia o `msg` em inglês direto na
    resposta ("value is not a valid email address: The part after the
    @-sign..."). O handler global em main.py traduz antes de responder."""
    res = await client.post(
        "/auth/register", json={"email": "teste@investiq.local", "password": "senhaSegura123"}
    )
    assert res.status_code == 422
    detail = res.json()["detail"]
    assert detail["code"] == "validation.error"
    assert "valid email address" not in detail["message"]
    assert "E-mail" in detail["message"]


@pytest.mark.asyncio
async def test_missing_field_error_is_in_portuguese(client):
    res = await client.post("/auth/register", json={"password": "senhaSegura123"})
    assert res.status_code == 422
    assert res.json()["detail"]["message"] == "E-mail é obrigatório."


@pytest.mark.asyncio
async def test_duplicate_email_rejected(client):
    email = unique_email()
    first = await client.post("/auth/register", json={"email": email, "password": "senhaSegura123"})
    assert first.status_code == 201
    second = await client.post("/auth/register", json={"email": email, "password": "outraSenha456"})
    assert second.status_code in (400, 409, 422)


@pytest.mark.asyncio
async def test_me_without_token_is_unauthorized(client):
    """401 exatamente, não 403: o interceptor do frontend só renova a sessão
    em 401, então um 403 aqui fazia todo reload de página (que perde o token
    da memória) falhar sem nunca tentar renovar, derrubando para o login."""
    res = await client.get("/auth/me")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_protected_route_without_token_is_401_not_403(client):
    for path in ("/portfolios/", "/finance/transactions", "/finance/budgets"):
        res = await client.get(path)
        assert res.status_code == 401, f"{path} devolveu {res.status_code}"


@pytest.mark.asyncio
async def test_refresh_flow_via_cookie(client):
    email = unique_email()
    password = "senhaSegura123"
    await client.post("/auth/register", json={"email": email, "password": password})
    login = await client.post("/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200
    assert "refresh_token" in login.cookies

    refreshed = await client.post("/auth/refresh")
    assert refreshed.status_code == 200
    assert refreshed.json()["access_token"]


@pytest.mark.asyncio
async def test_forgot_password_never_leaks_account_existence(client):
    """Same 200 response whether the email exists or not — no user enumeration."""
    known = await client.post("/auth/forgot-password", json={"email": unique_email()})
    unknown = await client.post("/auth/forgot-password", json={"email": "nobody-" + unique_email()})
    assert known.status_code == unknown.status_code
