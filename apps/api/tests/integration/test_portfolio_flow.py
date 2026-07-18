"""Integration: portfolio → position → buy/sell transactions → summary (WAC)."""
import pytest

from .conftest import register_and_login


async def _create_portfolio_with_position(client, headers, ticker="PETR4"):
    portfolio = await client.post("/portfolios/", json={"name": "Carteira BR", "currency": "BRL"}, headers=headers)
    assert portfolio.status_code == 201, portfolio.text
    portfolio_id = portfolio.json()["id"]

    position = await client.post(
        f"/portfolios/{portfolio_id}/positions",
        json={"ticker": ticker, "target_weight": 0.3},
        headers=headers,
    )
    assert position.status_code == 201, position.text
    return portfolio_id, position.json()["id"]


@pytest.mark.asyncio
async def test_weighted_average_cost_on_multiple_buys(client):
    session = await register_and_login(client)
    headers = session["headers"]
    portfolio_id, position_id = await _create_portfolio_with_position(client, headers)

    # Buy 1: 100 @ 30.50 + 5 fees -> total 3055.00, avg_cost 30.55
    buy1 = await client.post(
        "/portfolios/transactions",
        json={
            "position_id": position_id, "transaction_type": "buy",
            "quantity": 100, "unit_price": 30.50, "fees": 5, "fx_rate": 1,
            "transaction_date": "2026-01-15T12:00:00Z",
        },
        headers=headers,
    )
    assert buy1.status_code == 201, buy1.text
    assert buy1.json()["total_amount"] == "3055.00000000"

    # Buy 2: 50 @ 32.00 + 0 fees -> total 1600.00
    buy2 = await client.post(
        "/portfolios/transactions",
        json={
            "position_id": position_id, "transaction_type": "buy",
            "quantity": 50, "unit_price": 32.00, "fees": 0, "fx_rate": 1,
            "transaction_date": "2026-02-10T12:00:00Z",
        },
        headers=headers,
    )
    assert buy2.status_code == 201, buy2.text

    summary = await client.get(f"/portfolios/{portfolio_id}/summary", headers=headers)
    assert summary.status_code == 200
    position = summary.json()["positions"][0]
    assert position["quantity"] == "150.00000000"
    # WAC = (3055 + 1600) / 150 = 31.033333...
    assert position["avg_cost"].startswith("31.03")
    assert position["cost_basis_brl"] == "4655.00000000"


@pytest.mark.asyncio
async def test_sell_reduces_quantity_and_cost_proportionally(client):
    session = await register_and_login(client)
    headers = session["headers"]
    portfolio_id, position_id = await _create_portfolio_with_position(client, headers)

    await client.post(
        "/portfolios/transactions",
        json={
            "position_id": position_id, "transaction_type": "buy",
            "quantity": 100, "unit_price": 10, "fees": 0, "fx_rate": 1,
            "transaction_date": "2026-01-01T12:00:00Z",
        },
        headers=headers,
    )
    sell = await client.post(
        "/portfolios/transactions",
        json={
            "position_id": position_id, "transaction_type": "sell",
            "quantity": 40, "unit_price": 12, "fees": 0, "fx_rate": 1,
            "transaction_date": "2026-03-01T12:00:00Z",
        },
        headers=headers,
    )
    assert sell.status_code == 201, sell.text

    summary = await client.get(f"/portfolios/{portfolio_id}/summary", headers=headers)
    position = summary.json()["positions"][0]
    assert position["quantity"] == "60.00000000"
    # cost basis reduced proportionally: 1000 * (1 - 40/100) = 600
    assert position["cost_basis_brl"] == "600.00000000"


@pytest.mark.asyncio
async def test_sell_more_than_held_is_rejected(client):
    session = await register_and_login(client)
    headers = session["headers"]
    portfolio_id, position_id = await _create_portfolio_with_position(client, headers)

    await client.post(
        "/portfolios/transactions",
        json={
            "position_id": position_id, "transaction_type": "buy",
            "quantity": 10, "unit_price": 10, "fees": 0, "fx_rate": 1,
            "transaction_date": "2026-01-01T12:00:00Z",
        },
        headers=headers,
    )
    sell = await client.post(
        "/portfolios/transactions",
        json={
            "position_id": position_id, "transaction_type": "sell",
            "quantity": 999, "unit_price": 10, "fees": 0, "fx_rate": 1,
            "transaction_date": "2026-02-01T12:00:00Z",
        },
        headers=headers,
    )
    assert sell.status_code == 422


@pytest.mark.asyncio
async def test_empty_portfolio_summary_has_zeroed_totals(client):
    session = await register_and_login(client)
    headers = session["headers"]
    portfolio = await client.post("/portfolios/", json={"name": "Vazio", "currency": "BRL"}, headers=session["headers"])
    portfolio_id = portfolio.json()["id"]

    summary = await client.get(f"/portfolios/{portfolio_id}/summary", headers=headers)
    assert summary.status_code == 200
    body = summary.json()
    assert body["positions"] == []
    assert body["total_invested_brl"] == "0"
    assert body["allocation_by_type"] == []


@pytest.mark.asyncio
async def test_duplicate_position_for_same_ticker_conflicts(client):
    session = await register_and_login(client)
    headers = session["headers"]
    portfolio_id, _ = await _create_portfolio_with_position(client, headers)

    dup = await client.post(
        f"/portfolios/{portfolio_id}/positions", json={"ticker": "PETR4"}, headers=headers
    )
    assert dup.status_code == 409
