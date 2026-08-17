"""Integration: GET /portfolios/{id}/benchmark end-to-end against real Postgres.

BCB SGS (CDI) and Yahoo (^BVSP) are both external network calls blocked in
sandboxed/CI environments without egress — both are monkeypatched to
deterministic data here, exercising the real alignment/compounding logic in
service.get_portfolio_benchmark rather than mocking the whole function out.
"""
from datetime import date, timedelta
from decimal import Decimal

import pytest

from src.market_data.base import HistoricalBar
from src.portfolio import service
from .conftest import register_and_login


class _FakeProvider:
    """Returns the same synthetic OHLCV series regardless of ticker —
    covers both the position's own price history and ^BVSP in one patch."""

    def __init__(self, start: date, days: int):
        self._start = start
        self._days = days

    async def get_historical(self, ticker, period, interval):
        return [
            HistoricalBar(
                ticker=ticker,
                date=self._start + timedelta(days=i),
                open=Decimal("100"), high=Decimal("100"), low=Decimal("100"),
                close=Decimal("100") + i,
                volume=0,
            )
            for i in range(self._days)
        ]


@pytest.mark.asyncio
async def test_benchmark_aligns_portfolio_cdi_and_ibov(client, db_session, monkeypatch):
    session = await register_and_login(client)
    headers = session["headers"]
    portfolio = await client.post("/portfolios/", json={"name": "BR", "currency": "BRL"}, headers=headers)
    portfolio_id = portfolio.json()["id"]
    position = await client.post(
        f"/portfolios/{portfolio_id}/positions", json={"ticker": "VALE3"}, headers=headers
    )
    position_id = position.json()["id"]

    start = date.today() - timedelta(days=5)
    buy = await client.post(
        "/portfolios/transactions",
        json={
            "position_id": position_id, "transaction_type": "buy",
            "quantity": 10, "unit_price": 10, "fees": 0, "fx_rate": 1,
            "transaction_date": f"{start.isoformat()}T12:00:00Z",
        },
        headers=headers,
    )
    assert buy.status_code == 201

    async def fake_cdi(start_d, end_d, redis=None):
        return [(start_d + timedelta(days=i), Decimal("0.05")) for i in range((end_d - start_d).days + 1)]

    monkeypatch.setattr(service, "get_cdi_daily_rates", fake_cdi)
    monkeypatch.setattr(service, "get_provider", lambda *a, **kw: _FakeProvider(start, days=6))

    resp = await client.get(f"/portfolios/{portfolio_id}/benchmark?period=1m", headers=headers)
    assert resp.status_code == 200
    points = resp.json()
    assert len(points) >= 2

    first, last = points[0], points[-1]
    assert first["cdi_pct"] == "0.00"
    assert first["ibov_pct"] == "0.00"
    assert first["nasdaq_pct"] == "0.00"
    assert first["sp500_pct"] == "0.00"
    assert last["cdi_pct"] is not None and Decimal(last["cdi_pct"]) > Decimal("0")
    assert last["ibov_pct"] is not None and Decimal(last["ibov_pct"]) > Decimal("0")
    assert last["nasdaq_pct"] is not None and Decimal(last["nasdaq_pct"]) > Decimal("0")
    assert last["sp500_pct"] is not None and Decimal(last["sp500_pct"]) > Decimal("0")


@pytest.mark.asyncio
async def test_benchmark_degrades_gracefully_when_cdi_fetch_fails(client, db_session, monkeypatch):
    """A BCB outage shouldn't break the whole endpoint — cdi_pct just goes null."""
    session = await register_and_login(client)
    headers = session["headers"]
    portfolio = await client.post("/portfolios/", json={"name": "BR", "currency": "BRL"}, headers=headers)
    portfolio_id = portfolio.json()["id"]
    position = await client.post(
        f"/portfolios/{portfolio_id}/positions", json={"ticker": "VALE3"}, headers=headers
    )
    position_id = position.json()["id"]

    start = date.today() - timedelta(days=2)
    await client.post(
        "/portfolios/transactions",
        json={
            "position_id": position_id, "transaction_type": "buy",
            "quantity": 5, "unit_price": 20, "fees": 0, "fx_rate": 1,
            "transaction_date": f"{start.isoformat()}T12:00:00Z",
        },
        headers=headers,
    )

    async def failing_cdi(start_d, end_d, redis=None):
        return []  # get_cdi_daily_rates' own contract: never raises, empty on failure

    monkeypatch.setattr(service, "get_cdi_daily_rates", failing_cdi)
    monkeypatch.setattr(service, "get_provider", lambda *a, **kw: _FakeProvider(start, days=3))

    resp = await client.get(f"/portfolios/{portfolio_id}/benchmark?period=1m", headers=headers)
    assert resp.status_code == 200
    points = resp.json()
    assert len(points) >= 1
    assert all(p["cdi_pct"] is None for p in points)
    assert points[0]["portfolio_pct"] is not None


@pytest.mark.asyncio
async def test_benchmark_empty_portfolio_returns_empty_list(client, db_session):
    session = await register_and_login(client)
    headers = session["headers"]
    portfolio = await client.post("/portfolios/", json={"name": "Empty", "currency": "BRL"}, headers=headers)
    portfolio_id = portfolio.json()["id"]

    resp = await client.get(f"/portfolios/{portfolio_id}/benchmark?period=1m", headers=headers)
    assert resp.status_code == 200
    assert resp.json() == []
