"""Integration: price alerts, notifications, budgets, dividend income, CSV export."""
import pytest

from .conftest import register_and_login


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_alert_crud(client):
    session = await register_and_login(client)
    headers = session["headers"]

    create = await client.post(
        "/alerts", json={"ticker": "petr4", "alert_type": "price_above", "threshold": 40}, headers=headers
    )
    assert create.status_code == 201, create.text
    alert = create.json()
    assert alert["ticker"] == "PETR4"
    assert alert["is_active"] is True

    listing = await client.get("/alerts", headers=headers)
    assert len(listing.json()) == 1

    updated = await client.patch(f"/alerts/{alert['id']}", json={"threshold": 45}, headers=headers)
    assert updated.status_code == 200
    assert updated.json()["threshold"] == "45.00000000"

    deleted = await client.delete(f"/alerts/{alert['id']}", headers=headers)
    assert deleted.status_code == 204
    assert (await client.get("/alerts", headers=headers)).json() == []


@pytest.mark.asyncio
async def test_alerts_are_isolated_per_user(client):
    a = await register_and_login(client)
    b = await register_and_login(client)
    await client.post("/alerts", json={"ticker": "VALE3", "alert_type": "price_below", "threshold": 60}, headers=a["headers"])

    assert len(( await client.get("/alerts", headers=a["headers"])).json()) == 1
    assert (await client.get("/alerts", headers=b["headers"])).json() == []


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_notifications_start_empty_and_mark_read_works(client, db_session):
    import uuid
    from src.notifications.service import create_notification

    session = await register_and_login(client)
    headers = session["headers"]

    empty = await client.get("/notifications", headers=headers)
    assert empty.json() == {"items": [], "unread_count": 0}

    notif = await create_notification(
        uuid.UUID(session["user_id"]), "system", "Bem-vindo", "Conta criada", db_session
    )

    listing = await client.get("/notifications", headers=headers)
    assert listing.json()["unread_count"] == 1

    mark = await client.patch(f"/notifications/{notif.id}", headers=headers)
    assert mark.status_code == 200
    assert mark.json()["read_at"] is not None

    after = await client.get("/notifications", headers=headers)
    assert after.json()["unread_count"] == 0


# ---------------------------------------------------------------------------
# Budgets
# ---------------------------------------------------------------------------

async def _first_expense_category(client, headers) -> str:
    categories = (await client.get("/finance/categories", headers=headers)).json()
    return next(c["id"] for c in categories if c["category_type"] == "expense")


@pytest.mark.asyncio
async def test_budget_upsert_and_spend_tracking(client):
    session = await register_and_login(client)
    headers = session["headers"]
    category_id = await _first_expense_category(client, headers)

    create = await client.put("/finance/budgets", json={"category_id": category_id, "amount": 500}, headers=headers)
    assert create.status_code == 200
    assert create.json()["spent"] == "0"

    await client.post(
        "/finance/transactions",
        json={"transaction_type": "expense", "amount": 200, "category_id": category_id, "transaction_date": "2026-07-05T12:00:00Z"},
        headers=headers,
    )
    budgets = await client.get("/finance/budgets", headers=headers)
    budget = next(b for b in budgets.json() if b["category_id"] == category_id)
    assert budget["spent"] == "200.00000000"
    assert budget["pct_used"] == "0.4"

    # upsert again with a different amount replaces, doesn't duplicate
    update = await client.put("/finance/budgets", json={"category_id": category_id, "amount": 1000}, headers=headers)
    assert update.status_code == 200
    budgets_after = (await client.get("/finance/budgets", headers=headers)).json()
    assert len([b for b in budgets_after if b["category_id"] == category_id]) == 1
    assert next(b for b in budgets_after if b["category_id"] == category_id)["amount"] == "1000.00000000"


@pytest.mark.asyncio
async def test_exceeding_budget_creates_notification_once(client):
    session = await register_and_login(client)
    headers = session["headers"]
    category_id = await _first_expense_category(client, headers)

    await client.put("/finance/budgets", json={"category_id": category_id, "amount": 100}, headers=headers)

    # first transaction pushes spend to 80 — still under budget, no notification
    await client.post(
        "/finance/transactions",
        json={"transaction_type": "expense", "amount": 80, "category_id": category_id, "transaction_date": "2026-07-05T12:00:00Z"},
        headers=headers,
    )
    assert (await client.get("/notifications", headers=headers)).json()["unread_count"] == 0

    # second transaction crosses the threshold (80 -> 150) — notification fires
    await client.post(
        "/finance/transactions",
        json={"transaction_type": "expense", "amount": 70, "category_id": category_id, "transaction_date": "2026-07-06T12:00:00Z"},
        headers=headers,
    )
    assert (await client.get("/notifications", headers=headers)).json()["unread_count"] == 1

    # a third transaction, already over budget, does not spam another notification
    await client.post(
        "/finance/transactions",
        json={"transaction_type": "expense", "amount": 10, "category_id": category_id, "transaction_date": "2026-07-07T12:00:00Z"},
        headers=headers,
    )
    assert (await client.get("/notifications", headers=headers)).json()["unread_count"] == 1


@pytest.mark.asyncio
async def test_delete_budget(client):
    session = await register_and_login(client)
    headers = session["headers"]
    category_id = await _first_expense_category(client, headers)
    await client.put("/finance/budgets", json={"category_id": category_id, "amount": 300}, headers=headers)

    deleted = await client.delete(f"/finance/budgets/{category_id}", headers=headers)
    assert deleted.status_code == 204
    assert (await client.get("/finance/budgets", headers=headers)).json() == []


# ---------------------------------------------------------------------------
# Dividend income
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_portfolio_income_aggregates_dividends_by_month(client):
    session = await register_and_login(client)
    headers = session["headers"]

    portfolio = await client.post("/portfolios/", json={"name": "Renda", "currency": "BRL"}, headers=headers)
    portfolio_id = portfolio.json()["id"]
    position = await client.post(f"/portfolios/{portfolio_id}/positions", json={"ticker": "HGLG11"}, headers=headers)
    position_id = position.json()["id"]

    await client.post(
        "/portfolios/transactions",
        json={"position_id": position_id, "transaction_type": "buy", "quantity": 100, "unit_price": 10, "fees": 0, "fx_rate": 1, "transaction_date": "2026-01-01T12:00:00Z"},
        headers=headers,
    )
    await client.post(
        "/portfolios/transactions",
        json={"position_id": position_id, "transaction_type": "dividend", "quantity": 1, "unit_price": 50, "fees": 0, "fx_rate": 1, "transaction_date": "2026-03-10T12:00:00Z"},
        headers=headers,
    )
    await client.post(
        "/portfolios/transactions",
        json={"position_id": position_id, "transaction_type": "dividend", "quantity": 1, "unit_price": 30, "fees": 0, "fx_rate": 1, "transaction_date": "2026-03-20T12:00:00Z"},
        headers=headers,
    )

    income = await client.get(f"/portfolios/{portfolio_id}/income", params={"year": 2026}, headers=headers)
    assert income.status_code == 200
    body = income.json()
    assert body["total"] == "80.00000000"
    march = next(m for m in body["monthly_series"] if m["month"] == "2026-03")
    assert march["amount"] == "80.00000000"
    hglg = next(a for a in body["by_asset"] if a["ticker"] == "HGLG11")
    assert hglg["total_12m"] == "80.00000000"


# ---------------------------------------------------------------------------
# CSV export
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_finance_export_returns_csv(client):
    session = await register_and_login(client)
    headers = session["headers"]
    await client.post(
        "/finance/transactions",
        json={"transaction_type": "expense", "amount": 42.5, "description": "Café", "transaction_date": "2026-07-01T12:00:00Z"},
        headers=headers,
    )

    res = await client.get("/finance/transactions/export", headers=headers)
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    body = res.content.decode("utf-8-sig")
    assert "Café" in body
    assert "42,50" in body  # comma decimal, not dot


@pytest.mark.asyncio
async def test_portfolio_export_returns_csv(client):
    session = await register_and_login(client)
    headers = session["headers"]
    portfolio = await client.post("/portfolios/", json={"name": "Export Test", "currency": "BRL"}, headers=headers)
    portfolio_id = portfolio.json()["id"]
    await client.post(f"/portfolios/{portfolio_id}/positions", json={"ticker": "ITUB4"}, headers=headers)

    res = await client.get(f"/portfolios/{portfolio_id}/export", headers=headers)
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    assert "ITUB4" in res.content.decode("utf-8-sig")
