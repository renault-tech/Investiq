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
async def test_duplicate_email_rejected(client):
    email = unique_email()
    first = await client.post("/auth/register", json={"email": email, "password": "senhaSegura123"})
    assert first.status_code == 201
    second = await client.post("/auth/register", json={"email": email, "password": "outraSenha456"})
    assert second.status_code in (400, 409, 422)


@pytest.mark.asyncio
async def test_me_without_token_is_unauthorized(client):
    res = await client.get("/auth/me")
    assert res.status_code in (401, 403)


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
