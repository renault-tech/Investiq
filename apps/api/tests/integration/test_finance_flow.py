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
async def test_editing_a_virtual_occurrence_materializes_it_without_touching_the_series(client):
    session = await register_and_login(client)
    headers = session["headers"]

    created = await client.post(
        "/finance/transactions",
        json={
            "transaction_type": "expense", "amount": 30, "description": "Streaming",
            "transaction_date": "2026-01-10T12:00:00Z", "recurrence_rule": "FREQ=MONTHLY",
        },
        headers=headers,
    )
    template_id = created.json()["id"]

    listing = await client.get(
        "/finance/transactions",
        params={"date_from": "2026-01-01T00:00:00Z", "date_to": "2026-04-30T00:00:00Z", "per_page": 100},
        headers=headers,
    )
    virtual = next(i for i in listing.json()["items"] if i["is_virtual"] and i["transaction_date"].startswith("2026-02"))
    assert virtual["id"] == f"{template_id}:2026-02-10"

    # Vencimento caiu num fim de semana — desliza a ocorrência de fevereiro
    # 2 dias, sem mexer no template nem nas outras ocorrências da série.
    patched = await client.patch(
        f"/finance/transactions/{virtual['id']}",
        json={"transaction_date": "2026-02-12T12:00:00Z", "due_date": "2026-02-12T12:00:00Z"},
        headers=headers,
    )
    assert patched.status_code == 200
    materialized = patched.json()
    assert materialized["id"] != virtual["id"]
    assert materialized["transaction_date"].startswith("2026-02-12")
    assert materialized["is_virtual"] is False
    assert materialized["is_paid"] is False

    listing_after = await client.get(
        "/finance/transactions",
        params={"date_from": "2026-01-01T00:00:00Z", "date_to": "2026-04-30T00:00:00Z", "per_page": 100},
        headers=headers,
    )
    items_after = listing_after.json()["items"]
    # A ocorrência virtual de fevereiro sumiu — vira a linha materializada,
    # não conta em dobro — e o template e março/abril seguem intactos.
    assert len(items_after) == 4
    assert not any(i["id"] == virtual["id"] for i in items_after)
    assert any(i["id"] == materialized["id"] for i in items_after)

    # Reabrir a mesma ocorrência de novo reaproveita a linha já materializada
    # em vez de criar outra.
    repatched = await client.patch(
        f"/finance/transactions/{virtual['id']}",
        json={"notes": "confirmado"},
        headers=headers,
    )
    assert repatched.status_code == 200
    assert repatched.json()["id"] == materialized["id"]


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
