"""Integration: session/device management (GET/DELETE /auth/sessions,
POST /auth/sessions/revoke-others) and logout actually revoking the
refresh token server-side, not just clearing the cookie."""
import pytest

from .conftest import unique_email, register_and_login

CHROME_WINDOWS_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/115.0 Safari/537.36"
)
SAFARI_IPHONE_UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
)


@pytest.mark.asyncio
async def test_login_creates_a_current_session_with_device_label(client):
    email = unique_email()
    password = "senhaSegura123"
    await client.post("/auth/register", json={"email": email, "password": password})
    login = await client.post(
        "/auth/login", json={"email": email, "password": password}, headers={"User-Agent": CHROME_WINDOWS_UA}
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    listing = await client.get("/auth/sessions", headers=headers)
    assert listing.status_code == 200
    sessions = listing.json()
    assert len(sessions) == 1
    assert sessions[0]["is_current"] is True
    assert sessions[0]["device_info"] == "Chrome em Windows"


@pytest.mark.asyncio
async def test_refresh_keeps_exactly_one_active_session(client):
    await register_and_login(client)
    refreshed = await client.post("/auth/refresh")
    assert refreshed.status_code == 200

    me = await client.get("/auth/me", headers={"Authorization": f"Bearer {refreshed.json()['access_token']}"})
    assert me.status_code == 200
    sessions = await client.get("/auth/sessions", headers={"Authorization": f"Bearer {refreshed.json()['access_token']}"})
    assert len(sessions.json()) == 1
    assert sessions.json()[0]["is_current"] is True


@pytest.mark.asyncio
async def test_revoke_specific_session_invalidates_its_refresh_token(client):
    email = unique_email()
    password = "senhaSegura123"
    await client.post("/auth/register", json={"email": email, "password": password})

    login_a = await client.post(
        "/auth/login", json={"email": email, "password": password}, headers={"User-Agent": CHROME_WINDOWS_UA}
    )
    token_a = login_a.json()["access_token"]
    refresh_cookie_a = login_a.cookies.get("refresh_token")
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Second "device" logs in — same shared test client, but a distinct UA
    # so it's identifiable in the sessions list.
    login_b = await client.post(
        "/auth/login", json={"email": email, "password": password}, headers={"User-Agent": SAFARI_IPHONE_UA}
    )
    token_b = login_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    listing = (await client.get("/auth/sessions", headers=headers_b)).json()
    assert len(listing) == 2
    session_a_id = next(s["id"] for s in listing if s["device_info"] == "Chrome em Windows")

    revoke = await client.delete(f"/auth/sessions/{session_a_id}", headers=headers_b)
    assert revoke.status_code == 204

    remaining = (await client.get("/auth/sessions", headers=headers_b)).json()
    assert len(remaining) == 1
    assert remaining[0]["device_info"] == "Safari em iOS"

    # Device A's refresh token was actually revoked server-side, not just removed from the list
    replayed = await client.post("/auth/refresh", cookies={"refresh_token": refresh_cookie_a})
    assert replayed.status_code == 401


@pytest.mark.asyncio
async def test_revoke_other_sessions_keeps_only_the_current_one(client):
    email = unique_email()
    password = "senhaSegura123"
    await client.post("/auth/register", json={"email": email, "password": password})

    login_a = await client.post(
        "/auth/login", json={"email": email, "password": password}, headers={"User-Agent": CHROME_WINDOWS_UA}
    )
    refresh_cookie_a = login_a.cookies.get("refresh_token")

    login_b = await client.post(
        "/auth/login", json={"email": email, "password": password}, headers={"User-Agent": SAFARI_IPHONE_UA}
    )
    token_b = login_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    result = await client.post("/auth/sessions/revoke-others", headers=headers_b)
    assert result.status_code == 200
    assert result.json()["revoked_count"] == 1

    remaining = (await client.get("/auth/sessions", headers=headers_b)).json()
    assert len(remaining) == 1
    assert remaining[0]["is_current"] is True

    replayed = await client.post("/auth/refresh", cookies={"refresh_token": refresh_cookie_a})
    assert replayed.status_code == 401


@pytest.mark.asyncio
async def test_logout_revokes_the_refresh_token_server_side(client):
    email = unique_email()
    password = "senhaSegura123"
    await client.post("/auth/register", json={"email": email, "password": password})
    login = await client.post("/auth/login", json={"email": email, "password": password})
    refresh_cookie = login.cookies.get("refresh_token")

    logout = await client.post("/auth/logout")
    assert logout.status_code == 200

    # Replaying the pre-logout cookie must fail — it's revoked in the DB,
    # not just cleared from the browser.
    replayed = await client.post("/auth/refresh", cookies={"refresh_token": refresh_cookie})
    assert replayed.status_code == 401


@pytest.mark.asyncio
async def test_sessions_are_isolated_per_user(client):
    a = await register_and_login(client)
    b = await register_and_login(client)

    a_sessions = await client.get("/auth/sessions", headers=a["headers"])
    b_sessions = await client.get("/auth/sessions", headers=b["headers"])
    assert len(a_sessions.json()) == 1
    assert len(b_sessions.json()) == 1
    assert a_sessions.json()[0]["id"] != b_sessions.json()[0]["id"]


@pytest.mark.asyncio
async def test_cannot_revoke_another_users_session(client):
    a = await register_and_login(client)
    b = await register_and_login(client)

    a_session_id = (await client.get("/auth/sessions", headers=a["headers"])).json()[0]["id"]
    resp = await client.delete(f"/auth/sessions/{a_session_id}", headers=b["headers"])
    assert resp.status_code == 404  # not found scoped to this user

    still_there = await client.get("/auth/sessions", headers=a["headers"])
    assert len(still_there.json()) == 1
