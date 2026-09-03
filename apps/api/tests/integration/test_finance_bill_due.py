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


def _month_range(year: int, month: int) -> tuple[str, str]:
    if month == 12:
        next_year, next_month = year + 1, 1
    else:
        next_year, next_month = year, month + 1
    return f"{year:04d}-{month:02d}-01T00:00:00Z", f"{next_year:04d}-{next_month:02d}-01T00:00:00Z"


@pytest.mark.asyncio
async def test_bill_launched_one_month_due_next_shows_up_in_the_due_month(client):
    """Lançar uma conta em agosto com vencimento em outubro precisa mostrá-la
    em outubro, não em agosto — "qual mês" é o vencimento, não o lançamento."""
    session = await register_and_login(client)
    headers = session["headers"]

    created = await client.post(
        "/finance/transactions",
        json={
            "transaction_type": "expense", "amount": 500, "description": "Seguro anual",
            "transaction_date": "2026-08-15T12:00:00Z", "due_date": "2026-10-05T12:00:00Z",
        },
        headers=headers,
    )
    assert created.status_code == 201
    txn_id = created.json()["id"]

    launch_from, launch_to = _month_range(2026, 8)
    launch_month = await client.get(
        "/finance/transactions", params={"date_from": launch_from, "date_to": launch_to}, headers=headers,
    )
    assert all(i["id"] != txn_id for i in launch_month.json()["items"])

    due_from, due_to = _month_range(2026, 10)
    due_month = await client.get(
        "/finance/transactions", params={"date_from": due_from, "date_to": due_to}, headers=headers,
    )
    assert any(i["id"] == txn_id for i in due_month.json()["items"])


@pytest.mark.asyncio
async def test_future_recurring_occurrence_starts_unpaid_and_pay_confirms_it(client):
    """Ocorrência projetada de uma recorrência (salário, aluguel) precisa
    poder ser confirmada no mês em que ela de fato acontece — antes disso
    ela sempre chegava is_paid=True (fantasma), sem jeito de marcar."""
    session = await register_and_login(client)
    headers = session["headers"]
    now = datetime.now(timezone.utc)
    # Dia fixo (não "hoje - N dias"): um aniversário em 29/30/31 pode cair
    # num mês sem esse dia e pular a ocorrência que o teste espera existir.
    anchor = (now - timedelta(days=60)).replace(day=10)

    created = await client.post(
        "/finance/transactions",
        json={
            "transaction_type": "income", "amount": 4000, "description": "Salário",
            "transaction_date": _iso(anchor), "recurrence_rule": "FREQ=MONTHLY",
        },
        headers=headers,
    )
    assert created.status_code == 201

    future = now + timedelta(days=45)
    listing = await client.get(
        "/finance/transactions",
        params={"date_from": _iso(now), "date_to": _iso(future), "per_page": 100},
        headers=headers,
    )
    occurrence = next(i for i in listing.json()["items"] if i["is_virtual"])
    assert occurrence["is_paid"] is False
    assert occurrence["paid_at"] is None

    confirmed = await client.post(f"/finance/transactions/{occurrence['id']}/pay", headers=headers)
    assert confirmed.status_code == 200
    body = confirmed.json()
    assert body["is_virtual"] is False
    assert body["is_paid"] is True
    assert body["id"] != occurrence["id"]
    # Materializar zera is_recurring (a linha passa a ser independente da
    # série) — sem is_recurring_occurrence o frontend perdia todo sinal de
    # que essa linha veio de uma recorrência assim que ela era paga, e o
    # selo "Pago"/botão "Desfazer" sumiam da tabela.
    assert body["is_recurring_occurrence"] is True

    listing_after = await client.get(
        "/finance/transactions",
        params={"date_from": _iso(now), "date_to": _iso(future), "per_page": 100},
        headers=headers,
    )
    materialized = next(i for i in listing_after.json()["items"] if i["id"] == body["id"])
    assert materialized["is_recurring_occurrence"] is True


@pytest.mark.asyncio
async def test_past_recurring_occurrence_defaults_to_paid_without_materializing(client):
    """Uma ocorrência recorrente já vencida (salário do mês passado) chega
    marcada como paga por estimativa — sem virar linha própria só de olhar
    a lista —, mas continua sendo possível corrigir com "Desfazer"."""
    session = await register_and_login(client)
    headers = session["headers"]
    now = datetime.now(timezone.utc)
    anchor = (now - timedelta(days=95)).replace(day=10)  # dia fixo: evita mês sem dia 29/30/31 sumir uma ocorrência

    await client.post(
        "/finance/transactions",
        json={
            "transaction_type": "income", "amount": 4000, "description": "Salário",
            "transaction_date": _iso(anchor), "recurrence_rule": "FREQ=MONTHLY",
        },
        headers=headers,
    )

    past_window_end = now - timedelta(days=35)
    listing = await client.get(
        "/finance/transactions",
        params={"date_from": _iso(anchor), "date_to": _iso(past_window_end), "per_page": 100},
        headers=headers,
    )
    occurrences = [i for i in listing.json()["items"] if i["is_virtual"]]
    assert occurrences, "esperava pelo menos uma ocorrência virtual já vencida"
    for occ in occurrences:
        assert occ["is_paid"] is True
        assert occ["paid_at"] is None


@pytest.mark.asyncio
async def test_unpay_reverts_a_confirmed_transaction(client):
    session = await register_and_login(client)
    headers = session["headers"]

    created = await client.post(
        "/finance/transactions",
        json={
            "transaction_type": "expense", "amount": 40, "description": "Mercado",
            "transaction_date": _iso(datetime.now(timezone.utc)),
        },
        headers=headers,
    )
    txn_id = created.json()["id"]
    assert created.json()["is_paid"] is True

    reverted = await client.post(f"/finance/transactions/{txn_id}/unpay", headers=headers)
    assert reverted.status_code == 200
    assert reverted.json()["is_paid"] is False
    assert reverted.json()["paid_at"] is None

    # Idempotente.
    reverted_again = await client.post(f"/finance/transactions/{txn_id}/unpay", headers=headers)
    assert reverted_again.status_code == 200
    assert reverted_again.json()["is_paid"] is False


@pytest.mark.asyncio
async def test_unpay_a_past_recurring_occurrence_materializes_it_unpaid(client):
    """Corrige a estimativa: um salário do mês passado que na prática não
    caiu — "Desfazer" precisa materializar a ocorrência como não paga, não
    só recusar por ela ainda não ter linha própria."""
    session = await register_and_login(client)
    headers = session["headers"]
    now = datetime.now(timezone.utc)
    anchor = (now - timedelta(days=95)).replace(day=10)  # dia fixo: evita mês sem dia 29/30/31 sumir uma ocorrência

    await client.post(
        "/finance/transactions",
        json={
            "transaction_type": "income", "amount": 4000, "description": "Salário",
            "transaction_date": _iso(anchor), "recurrence_rule": "FREQ=MONTHLY",
        },
        headers=headers,
    )
    past_window_end = now - timedelta(days=35)
    listing = await client.get(
        "/finance/transactions",
        params={"date_from": _iso(anchor), "date_to": _iso(past_window_end), "per_page": 100},
        headers=headers,
    )
    occurrence = next(i for i in listing.json()["items"] if i["is_virtual"])
    assert occurrence["is_paid"] is True  # estimativa

    reverted = await client.post(f"/finance/transactions/{occurrence['id']}/unpay", headers=headers)
    assert reverted.status_code == 200
    body = reverted.json()
    assert body["is_virtual"] is False
    assert body["is_paid"] is False


@pytest.mark.asyncio
async def test_recurring_due_offset_carries_over_to_future_occurrences(client):
    """Uma recorrência lançada dia 25 com vencimento 11 dias depois (aluguel
    fechado antes do vencimento) precisa manter essa distância em toda
    ocorrência futura, não só na primeira — e cada ocorrência aparece no mês
    do SEU vencimento, não da sua data de lançamento.

    O deslocamento é um timedelta fixo (a distância entre as duas datas do
    template), não "mesmo dia do mês seguinte" — a ocorrência de fevereiro
    (28 dias) vence 3 dias depois do que a de janeiro (31 dias) venceria na
    mesma lógica de "dia 5". Um vencimento com data própria por ocorrência
    é o caso raro que só existe via API hoje (a UI nem oferece esse campo
    numa recorrência, ver TransactionModal) — o valor de fazer o deslocamento
    seguir o dia-do-mês exato (duas expansões de rrule em paralelo) não
    parece compensar a complexidade para esse caso extremo."""
    session = await register_and_login(client)
    headers = session["headers"]

    created = await client.post(
        "/finance/transactions",
        json={
            "transaction_type": "expense", "amount": 1200, "description": "Aluguel",
            "transaction_date": "2026-01-25T12:00:00Z", "due_date": "2026-02-05T12:00:00Z",
            "recurrence_rule": "FREQ=MONTHLY",
        },
        headers=headers,
    )
    assert created.status_code == 201

    # Ocorrência de fevereiro (lançamento) vence em março — aparece no mês
    # de março, não no de fevereiro.
    feb_from, feb_to = _month_range(2026, 2)
    feb_listing = await client.get(
        "/finance/transactions", params={"date_from": feb_from, "date_to": feb_to, "per_page": 100}, headers=headers,
    )
    assert not any(i["is_virtual"] and i["transaction_date"].startswith("2026-02") for i in feb_listing.json()["items"])

    mar_from, mar_to = _month_range(2026, 3)
    mar_listing = await client.get(
        "/finance/transactions", params={"date_from": mar_from, "date_to": mar_to, "per_page": 100}, headers=headers,
    )
    march_items = mar_listing.json()["items"]
    occurrence = next(i for i in march_items if i["is_virtual"] and i["transaction_date"].startswith("2026-02"))
    # 11 dias (o offset do template) depois de 2026-02-25 — não "dia 5",
    # porque fevereiro só tem 28 dias em 2026 (ver docstring acima).
    assert occurrence["due_date"].startswith("2026-03-08")
