"""Integration: burn rate, taxa de poupança, fôlego e tendência por categoria."""
from datetime import datetime, timezone

import pytest
from dateutil.relativedelta import relativedelta

from .conftest import register_and_login


def _month_start(dt: datetime) -> datetime:
    return dt.replace(day=1, hour=12, minute=0, second=0, microsecond=0)


def _iso(dt: datetime) -> str:
    return dt.isoformat()


async def _expense(client, headers, amount: float, when: datetime, category_id: str | None = None):
    payload = {
        "transaction_type": "expense", "amount": amount,
        "description": "Gasto", "transaction_date": _iso(when),
    }
    if category_id:
        payload["category_id"] = category_id
    res = await client.post("/finance/transactions", headers=headers, json=payload)
    assert res.status_code == 201, res.text


async def _income(client, headers, amount: float, when: datetime):
    res = await client.post("/finance/transactions", headers=headers, json={
        "transaction_type": "income", "amount": amount,
        "description": "Receita", "transaction_date": _iso(when),
    })
    assert res.status_code == 201, res.text


@pytest.mark.asyncio
async def test_burn_rate_averages_the_last_three_closed_months(client):
    headers = (await register_and_login(client))["headers"]
    now = datetime.now(timezone.utc)

    for i, amount in [(1, 300), (2, 300), (3, 300)]:
        await _expense(client, headers, amount, _month_start(now) - relativedelta(months=i))
    # Gasto no mês corrente (parcial) não deve entrar no burn rate.
    await _expense(client, headers, 99999, now)

    analytics = (await client.get("/finance/analytics?months=6", headers=headers)).json()
    assert float(analytics["burn_rate"]) == pytest.approx(300.0)


@pytest.mark.asyncio
async def test_savings_rate_reflects_income_minus_expense_over_income(client):
    headers = (await register_and_login(client))["headers"]
    now = datetime.now(timezone.utc)

    await _income(client, headers, 1000, now)
    await _expense(client, headers, 700, now)

    analytics = (await client.get("/finance/analytics?months=3", headers=headers)).json()
    current = analytics["savings_series"][-1]
    assert float(current["income"]) == pytest.approx(1000.0)
    assert float(current["expense"]) == pytest.approx(700.0)
    assert float(current["savings_rate"]) == pytest.approx(0.3)


@pytest.mark.asyncio
async def test_savings_rate_is_null_when_there_is_no_income(client):
    headers = (await register_and_login(client))["headers"]
    now = datetime.now(timezone.utc)
    await _expense(client, headers, 50, now)

    analytics = (await client.get("/finance/analytics?months=3", headers=headers)).json()
    current = analytics["savings_series"][-1]
    assert current["savings_rate"] is None


@pytest.mark.asyncio
async def test_runway_divides_consolidated_balance_by_burn_rate(client):
    headers = (await register_and_login(client))["headers"]
    now = datetime.now(timezone.utc)
    await client.post("/finance/accounts", json={"name": "Conta", "opening_balance": 3000}, headers=headers)

    for i in (1, 2, 3):
        await _expense(client, headers, 500, _month_start(now) - relativedelta(months=i))

    analytics = (await client.get("/finance/analytics?months=6", headers=headers)).json()
    assert float(analytics["burn_rate"]) == pytest.approx(500.0)
    assert float(analytics["runway_months"]) == pytest.approx(6.0)  # 3000 / 500


@pytest.mark.asyncio
async def test_runway_is_null_when_burn_rate_is_zero(client):
    headers = (await register_and_login(client))["headers"]
    analytics = (await client.get("/finance/analytics?months=6", headers=headers)).json()
    assert analytics["burn_rate"] == "0"
    assert analytics["runway_months"] is None


@pytest.mark.asyncio
async def test_category_trend_flags_a_spike_above_the_six_month_median(client):
    headers = (await register_and_login(client))["headers"]
    now = datetime.now(timezone.utc)
    categories = (await client.get("/finance/categories", headers=headers)).json()
    category_id = next(c["id"] for c in categories if c["category_type"] == "expense")

    for i in range(1, 7):
        await _expense(client, headers, 100, _month_start(now) - relativedelta(months=i), category_id)
    # Este mês, o dobro do normal.
    await _expense(client, headers, 200, now, category_id)

    analytics = (await client.get("/finance/analytics?months=6", headers=headers)).json()
    trend = next(t for t in analytics["category_trends"] if t["category_id"] == category_id)
    assert float(trend["baseline_median"]) == pytest.approx(100.0)
    assert float(trend["current_amount"]) == pytest.approx(200.0)
    assert trend["direction"] == "up"
    assert float(trend["pct_change"]) == pytest.approx(1.0)  # +100%


@pytest.mark.asyncio
async def test_category_matrix_lines_up_with_the_months_axis(client):
    headers = (await register_and_login(client))["headers"]
    now = datetime.now(timezone.utc)
    categories = (await client.get("/finance/categories", headers=headers)).json()
    category_id = next(c["id"] for c in categories if c["category_type"] == "expense")

    await _expense(client, headers, 42, now, category_id)

    analytics = (await client.get("/finance/analytics?months=3", headers=headers)).json()
    row = next(r for r in analytics["category_matrix"] if r["category_id"] == category_id)
    assert len(row["values"]) == len(analytics["months"])
    current_index = analytics["months"].index(analytics["months"][-1])
    assert float(row["values"][current_index]) == pytest.approx(42.0)


@pytest.mark.asyncio
async def test_analytics_isolated_per_user(client):
    a = await register_and_login(client)
    b = await register_and_login(client)
    now = datetime.now(timezone.utc)
    await _expense(client, a["headers"], 500, now)

    analytics_b = (await client.get("/finance/analytics?months=3", headers=b["headers"])).json()
    assert float(analytics_b["savings_series"][-1]["expense"]) == 0.0
