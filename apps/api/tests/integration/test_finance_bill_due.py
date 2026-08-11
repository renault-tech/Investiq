"""Integration: contas a pagar — due_date separado de transaction_date,
botão "Pagar" e o worker que notifica no vencimento."""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import redis.asyncio as aioredis
from sqlalchemy import select

from src.config import settings
from src.finance.models import FinancialTransaction
from src.workers.bill_due_checker import _LOCK_KEY, bill_due_checker_job
from .conftest import register_and_login


async def _clear_bill_due_lock() -> None:
    """The job's Redis lock (TTL 300s) is a global key, not test-scoped — a
    previous run against the same Redis instance (e.g. re-running this test
    file locally within the TTL window) would otherwise make this test flaky
    regardless of what it's actually asserting."""
    client = aioredis.from_url(settings.REDIS_URL)
    try:
        await client.delete(_LOCK_KEY)
    finally:
        await client.aclose()


def _iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


@pytest.mark.asyncio
async def test_transaction_without_due_date_is_paid_immediately(client):
    session = await register_and_login(client)
    headers = session["headers"]
    now = datetime.now(timezone.utc)

    res = await client.post(
        "/finance/transactions",
        json={
            "transaction_type": "expense", "amount": 50, "description": "Mercado",
            "transaction_date": _iso(now),
        },
        headers=headers,
    )
    assert res.status_code == 201
    body = res.json()
    assert body["is_paid"] is True
    assert body["paid_at"] is not None
    # Sem due_date explícito, vence na própria data de lançamento.
    assert body["due_date"][:10] == body["transaction_date"][:10]


@pytest.mark.asyncio
async def test_future_due_date_starts_unpaid_until_pay_endpoint(client):
    session = await register_and_login(client)
    headers = session["headers"]
    now = datetime.now(timezone.utc)
    future = now + timedelta(days=10)

    created = await client.post(
        "/finance/transactions",
        json={
            "transaction_type": "expense", "amount": 200, "description": "Aluguel",
            "transaction_date": _iso(now), "due_date": _iso(future),
        },
        headers=headers,
    )
    assert created.status_code == 201
    body = created.json()
    assert body["is_paid"] is False
    assert body["paid_at"] is None
    assert body["due_date"][:10] == future.strftime("%Y-%m-%d")

    pay = await client.post(f"/finance/transactions/{body['id']}/pay", headers=headers)
    assert pay.status_code == 200
    paid = pay.json()
    assert paid["is_paid"] is True
    assert paid["paid_at"] is not None

    # Idempotente: pagar de novo não é erro, só devolve o estado já pago.
    pay_again = await client.post(f"/finance/transactions/{body['id']}/pay", headers=headers)
    assert pay_again.status_code == 200
    assert pay_again.json()["is_paid"] is True


@pytest.mark.asyncio
async def test_bill_due_checker_notifies_once_when_due_date_arrives(client, db_session):
    session = await register_and_login(client)
    headers = session["headers"]
    now = datetime.now(timezone.utc)
    future = now + timedelta(hours=1)

    created = await client.post(
        "/finance/transactions",
        json={
            "transaction_type": "expense", "amount": 80, "description": "Internet",
            "transaction_date": _iso(now), "due_date": _iso(future),
        },
        headers=headers,
    )
    assert created.status_code == 201
    assert created.json()["is_paid"] is False
    txn_id = created.json()["id"]

    # Simula o vencimento chegando — o worker roda periodicamente e não deve
    # depender de rodar exatamente no segundo em que due_date passou.
    result = await db_session.execute(
        select(FinancialTransaction).where(FinancialTransaction.id == uuid.UUID(txn_id))
    )
    row = result.scalar_one()
    row.due_date = now - timedelta(hours=1)
    await db_session.commit()

    await _clear_bill_due_lock()
    await bill_due_checker_job()

    notifications = await client.get("/notifications", headers=headers)
    assert notifications.status_code == 200
    bill_notifs = [n for n in notifications.json()["items"] if n["type"] == "bill_due"]
    assert len(bill_notifs) == 1
    assert "Internet" in bill_notifs[0]["title"]

    # Rodar de novo não duplica — mesmo limpando o lock, bill_notified_at
    # (já marcado na 1ª rodada) impede uma segunda notificação da mesma conta.
    await _clear_bill_due_lock()
    await bill_due_checker_job()
    notifications_again = await client.get("/notifications", headers=headers)
    bill_notifs_again = [n for n in notifications_again.json()["items"] if n["type"] == "bill_due"]
    assert len(bill_notifs_again) == 1
