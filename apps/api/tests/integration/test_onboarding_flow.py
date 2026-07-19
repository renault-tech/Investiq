"""Integration: GET /onboarding/status — checklist steps derived from real
data (no separate "completed steps" table to fall out of sync)."""
import pytest

from .conftest import register_and_login


@pytest.mark.asyncio
async def test_fresh_user_has_no_steps_done(client):
    session = await register_and_login(client)
    resp = await client.get("/onboarding/status", headers=session["headers"])
    assert resp.status_code == 200
    assert resp.json() == {
        "has_portfolio": False,
        "has_position": False,
        "has_transaction": False,
        "has_finance_transaction": False,
        "has_goal": False,
    }


@pytest.mark.asyncio
async def test_steps_flip_true_as_the_user_actually_does_them(client):
    session = await register_and_login(client)
    headers = session["headers"]

    portfolio = await client.post("/portfolios/", json={"name": "P", "currency": "BRL"}, headers=headers)
    portfolio_id = portfolio.json()["id"]
    status_after_portfolio = (await client.get("/onboarding/status", headers=headers)).json()
    assert status_after_portfolio["has_portfolio"] is True
    assert status_after_portfolio["has_position"] is False

    position = await client.post(f"/portfolios/{portfolio_id}/positions", json={"ticker": "VALE3"}, headers=headers)
    position_id = position.json()["id"]
    status_after_position = (await client.get("/onboarding/status", headers=headers)).json()
    assert status_after_position["has_position"] is True
    assert status_after_position["has_transaction"] is False

    await client.post(
        "/portfolios/transactions",
        json={
            "position_id": position_id, "transaction_type": "buy",
            "quantity": 1, "unit_price": 10, "fees": 0, "fx_rate": 1,
            "transaction_date": "2026-01-01T12:00:00Z",
        },
        headers=headers,
    )
    assert (await client.get("/onboarding/status", headers=headers)).json()["has_transaction"] is True

    categories = (await client.get("/finance/categories", headers=headers)).json()
    category_id = next(c["id"] for c in categories if c["category_type"] == "expense")
    await client.post(
        "/finance/transactions",
        json={"transaction_type": "expense", "amount": 50, "category_id": category_id, "transaction_date": "2026-01-01T12:00:00Z"},
        headers=headers,
    )
    assert (await client.get("/onboarding/status", headers=headers)).json()["has_finance_transaction"] is True

    await client.post("/finance/goals", json={"name": "Meta", "target_amount": 100}, headers=headers)
    final_status = (await client.get("/onboarding/status", headers=headers)).json()
    assert final_status == {
        "has_portfolio": True,
        "has_position": True,
        "has_transaction": True,
        "has_finance_transaction": True,
        "has_goal": True,
    }


@pytest.mark.asyncio
async def test_soft_deleted_finance_transaction_does_not_count(client):
    session = await register_and_login(client)
    headers = session["headers"]

    categories = (await client.get("/finance/categories", headers=headers)).json()
    category_id = next(c["id"] for c in categories if c["category_type"] == "expense")
    created = await client.post(
        "/finance/transactions",
        json={"transaction_type": "expense", "amount": 50, "category_id": category_id, "transaction_date": "2026-01-01T12:00:00Z"},
        headers=headers,
    )
    txn_id = created.json()["id"]
    assert (await client.get("/onboarding/status", headers=headers)).json()["has_finance_transaction"] is True

    await client.delete(f"/finance/transactions/{txn_id}", headers=headers)
    assert (await client.get("/onboarding/status", headers=headers)).json()["has_finance_transaction"] is False


@pytest.mark.asyncio
async def test_onboarding_status_is_isolated_per_user(client):
    a = await register_and_login(client)
    b = await register_and_login(client)
    await client.post("/portfolios/", json={"name": "A's", "currency": "BRL"}, headers=a["headers"])

    assert (await client.get("/onboarding/status", headers=a["headers"])).json()["has_portfolio"] is True
    assert (await client.get("/onboarding/status", headers=b["headers"])).json()["has_portfolio"] is False
