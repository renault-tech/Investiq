"""Integration: canal de feedback do usuário dentro do produto."""
import pytest

from .conftest import register_and_login


@pytest.mark.asyncio
async def test_feedback_is_saved_with_the_page_it_came_from(client):
    session = await register_and_login(client)
    headers = session["headers"]

    created = await client.post(
        "/feedback",
        json={"category": "bug", "message": "O saldo da conta X não bate.", "page_path": "/finances"},
        headers=headers,
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["category"] == "bug"
    assert body["page_path"] == "/finances"

    listing = await client.get("/feedback", headers=headers)
    assert listing.status_code == 200
    assert [item["id"] for item in listing.json()] == [body["id"]]


@pytest.mark.asyncio
async def test_feedback_of_one_user_is_not_visible_to_another(client):
    first = await register_and_login(client)
    await client.post(
        "/feedback",
        json={"category": "idea", "message": "Queria exportar em Excel."},
        headers=first["headers"],
    )

    second = await register_and_login(client)
    listing = await client.get("/feedback", headers=second["headers"])
    assert listing.json() == []


@pytest.mark.asyncio
async def test_empty_feedback_is_rejected(client):
    session = await register_and_login(client)
    res = await client.post("/feedback", json={"message": " "}, headers=session["headers"])
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_feedback_requires_login(client):
    res = await client.post("/feedback", json={"message": "sem sessão"})
    assert res.status_code == 401
