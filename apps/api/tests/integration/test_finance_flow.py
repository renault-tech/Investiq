"""Integration: finance categories seed, transactions CRUD, recurrence, soft-delete, summary."""
import pytest

from .conftest import register_and_login


@pytest.mark.asyncio
async def test_categories_seeded_in_ptbr_on_first_access(client):
    session = await register_and_login(client)
    res = await client.get("/finance/categories", headers=session["headers"])
    assert res.status_code == 200
    names = {c["name"] for c in res.json()}
    assert "Alimentação" in names
    assert "Salário" in names


@pytest.mark.asyncio
async def test_seed_is_idempotent_across_repeated_calls(client):
    session = await register_and_login(client)
    first = await client.get("/finance/categories", headers=session["headers"])
    second = await client.get("/finance/categories", headers=session["headers"])
    assert len(first.json()) == len(second.json())


@pytest.mark.asyncio
async def test_soft_delete_hides_transaction_but_keeps_row(client, db_session):
    from sqlalchemy import select
    from src.finance.models import FinancialTransaction

    session = await register_and_login(client)
    headers = session["headers"]

    created = await client.post(
        "/finance/transactions",
        json={"transaction_type": "expense", "amount": 99.9, "description": "Teste", "transaction_date": "2026-07-05T12:00:00Z"},
        headers=headers,
    )
    txn_id = created.json()["id"]

    delete = await client.delete(f"/finance/transactions/{txn_id}", headers=headers)
    assert delete.status_code == 204

    listing = await client.get("/finance/transactions", headers=headers)
    assert all(item["id"] != txn_id for item in listing.json()["items"])

    result = await db_session.execute(select(FinancialTransaction).where(FinancialTransaction.id == txn_id))
    row = result.scalar_one()
    assert row.deleted_at is not None


@pytest.mark.asyncio
async def test_monthly_recurring_transaction_expands_into_future_months(client):
    session = await register_and_login(client)
    headers = session["headers"]

    await client.post(
        "/finance/transactions",
        json={
            "transaction_type": "expense", "amount": 30, "description": "Streaming",
            "transaction_date": "2026-01-10T12:00:00Z", "recurrence_rule": "FREQ=MONTHLY",
        },
        headers=headers,
    )

    listing = await client.get(
        "/finance/transactions",
        params={"date_from": "2026-01-01T00:00:00Z", "date_to": "2026-04-30T00:00:00Z", "per_page": 100},
        headers=headers,
    )
    assert listing.status_code == 200
    items = listing.json()["items"]
    # Jan (real row) + Feb, Mar, Apr (virtual occurrences)
    assert len(items) == 4
    assert sum(1 for i in items if i["is_virtual"]) == 3


@pytest.mark.asyncio
async def test_summary_aggregates_income_expense_and_by_category(client):
    session = await register_and_login(client)
    headers = session["headers"]

    await client.post(
        "/finance/transactions",
        json={"transaction_type": "income", "amount": 5000, "transaction_date": "2026-07-05T12:00:00Z"},
        headers=headers,
    )
    await client.post(
        "/finance/transactions",
        json={"transaction_type": "expense", "amount": 200, "transaction_date": "2026-07-06T12:00:00Z"},
        headers=headers,
    )

    summary = await client.get("/finance/summary", params={"month": "2026-07"}, headers=headers)
    assert summary.status_code == 200
    body = summary.json()
    assert body["income"] == "5000.00000000"
    assert body["expense"] == "200.00000000"
    assert body["net"] == "4800.00000000"


@pytest.mark.asyncio
async def test_summary_rejects_malformed_month(client):
    session = await register_and_login(client)
    res = await client.get("/finance/summary", params={"month": "not-a-month"}, headers=session["headers"])
    assert res.status_code == 422
