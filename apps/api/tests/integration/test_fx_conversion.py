"""Integration: foreign-currency assets are valued in BRL using fx_rates.

Regression coverage for a real bug found by re-reading the codebase after
Fase 7: get_portfolio_summary hardcoded fx_rate_to_brl = 1 for every asset
(the field was collected but never applied), and add_position/alerts'
_get_or_create_asset both hardcoded new assets to currency="BRL" regardless
of ticker — so even fixing the conversion math would have stayed dead code
for a freshly-added US ticker. Both are fixed together here.
"""
from datetime import date, timezone

import pytest
from sqlalchemy import select

from src.market_data.base import is_b3_ticker
from src.portfolio import service
from src.portfolio.models import Asset, FxRate
from .conftest import register_and_login


class _NoQuotesProvider:
    """Simulates "no live quote available" deterministically. Without this,
    these tests relied on the sandbox's blocked network to force the
    asset.last_price fallback path — which passed locally but broke in real
    CI, where the runner has actual internet access and the live Yahoo/Brapi
    quote came back for real, silently overriding the seeded stub price."""

    async def get_quotes(self, tickers):
        return {}


def test_is_b3_ticker_classifies_correctly():
    assert is_b3_ticker("PETR4") is True
    assert is_b3_ticker("HGLG11") is True
    assert is_b3_ticker("AAPL") is False
    assert is_b3_ticker("VOO") is False
    assert is_b3_ticker("PETR4.SA") is False  # already has an exchange suffix


@pytest.mark.asyncio
async def test_new_us_ticker_position_is_tagged_usd(client, db_session):
    session = await register_and_login(client)
    headers = session["headers"]
    portfolio = await client.post("/portfolios/", json={"name": "Intl", "currency": "USD"}, headers=headers)
    portfolio_id = portfolio.json()["id"]

    res = await client.post(f"/portfolios/{portfolio_id}/positions", json={"ticker": "AAPL"}, headers=headers)
    assert res.status_code == 201

    asset = (await db_session.execute(select(Asset).where(Asset.ticker == "AAPL"))).scalar_one()
    assert asset.currency == "USD"


@pytest.mark.asyncio
async def test_new_b3_ticker_position_is_tagged_brl(client, db_session):
    session = await register_and_login(client)
    headers = session["headers"]
    portfolio = await client.post("/portfolios/", json={"name": "BR", "currency": "BRL"}, headers=headers)
    portfolio_id = portfolio.json()["id"]

    await client.post(f"/portfolios/{portfolio_id}/positions", json={"ticker": "VALE3"}, headers=headers)

    asset = (await db_session.execute(select(Asset).where(Asset.ticker == "VALE3"))).scalar_one()
    assert asset.currency == "BRL"


@pytest.mark.asyncio
async def test_summary_converts_usd_market_value_to_brl(client, db_session, monkeypatch):
    monkeypatch.setattr(service, "get_provider", lambda *a, **kw: _NoQuotesProvider())
    session = await register_and_login(client)
    headers = session["headers"]
    portfolio = await client.post("/portfolios/", json={"name": "Intl", "currency": "USD"}, headers=headers)
    portfolio_id = portfolio.json()["id"]

    position = await client.post(f"/portfolios/{portfolio_id}/positions", json={"ticker": "AAPL"}, headers=headers)
    position_id = position.json()["id"]

    # Buy 10 @ $100, fx_rate 5.00 at purchase time -> cost basis is already BRL (5000)
    buy = await client.post(
        "/portfolios/transactions",
        json={
            "position_id": position_id, "transaction_type": "buy",
            "quantity": 10, "unit_price": 100, "fees": 0, "fx_rate": 5.00,
            "transaction_date": "2026-01-01T12:00:00Z",
        },
        headers=headers,
    )
    assert buy.status_code == 201
    assert buy.json()["total_amount"] == "5000.00000000"

    # No live network in this sandbox -> seed last_price directly (the same
    # fallback get_portfolio_summary uses when a live quote isn't available)
    # and seed today's USD->BRL rate (normally populated by fx_updater).
    asset = (await db_session.execute(select(Asset).where(Asset.ticker == "AAPL"))).scalar_one()
    asset.last_price = 120  # today's price moved from $100 -> $120
    db_session.add(FxRate(from_currency="USD", to_currency="BRL", rate=5.50, date=date.today()))
    await db_session.commit()

    summary = await client.get(f"/portfolios/{portfolio_id}/summary", headers=headers)
    assert summary.status_code == 200
    pos = summary.json()["positions"][0]

    # current_price is returned already converted to BRL for display
    assert pos["current_price"] == "660.00000000"          # 120 * 5.50
    assert pos["market_value_brl"] == "6600.00"             # 10 * 660
    # pnl vs BRL cost basis: (660 - 500 avg_cost) * 10 = 1600
    assert pos["pnl_absolute"] == "1600.00"

    allocation = summary.json()["allocation_by_type"]
    assert allocation[0]["value"] == "6600.00"


@pytest.mark.asyncio
async def test_summary_falls_back_to_1to1_when_fx_rate_missing(client, db_session, monkeypatch):
    """No fx_rates row yet (e.g. worker hasn't run) shouldn't crash the summary."""
    monkeypatch.setattr(service, "get_provider", lambda *a, **kw: _NoQuotesProvider())
    session = await register_and_login(client)
    headers = session["headers"]
    portfolio = await client.post("/portfolios/", json={"name": "Intl", "currency": "USD"}, headers=headers)
    portfolio_id = portfolio.json()["id"]
    position = await client.post(f"/portfolios/{portfolio_id}/positions", json={"ticker": "VOO"}, headers=headers)
    position_id = position.json()["id"]

    await client.post(
        "/portfolios/transactions",
        json={
            "position_id": position_id, "transaction_type": "buy",
            "quantity": 1, "unit_price": 50, "fees": 0, "fx_rate": 1,
            "transaction_date": "2026-01-01T12:00:00Z",
        },
        headers=headers,
    )
    asset = (await db_session.execute(select(Asset).where(Asset.ticker == "VOO"))).scalar_one()
    asset.last_price = 60
    await db_session.commit()

    summary = await client.get(f"/portfolios/{portfolio_id}/summary", headers=headers)
    assert summary.status_code == 200
    assert summary.json()["positions"][0]["current_price"] == "60.00000000"  # 1:1 fallback
