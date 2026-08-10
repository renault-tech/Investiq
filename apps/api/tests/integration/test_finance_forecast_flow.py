"""Integration: projeção de fluxo de caixa — comprometido vs estimado."""
from datetime import date, datetime, timedelta, timezone

import pytest
from dateutil.relativedelta import relativedelta

from .conftest import register_and_login


def _month_start(dt: datetime) -> datetime:
    return dt.replace(day=1, hour=12, minute=0, second=0, microsecond=0)


def _iso(dt: datetime) -> str:
    return dt.isoformat()


@pytest.mark.asyncio
async def test_recurring_expense_shows_as_committed_next_month(client):
    headers = (await register_and_login(client))["headers"]
    now = datetime.now(timezone.utc)
    account = (await client.post("/finance/accounts", json={"name": "Conta", "opening_balance": 1000}, headers=headers)).json()

    await client.post("/finance/transactions", headers=headers, json={
        "transaction_type": "expense", "amount": 200, "description": "Aluguel",
        "bank_account_id": account["id"], "transaction_date": _iso(now),
        "recurrence_rule": "FREQ=MONTHLY",
    })

    forecast = (await client.get("/finance/forecast?months=3", headers=headers)).json()
    # O template da recorrência já é a 1ª ocorrência, datada de hoje — o
    # saldo atual já reflete essa despesa (1000 - 200).
    assert forecast["current_balance"] == "800.00000000"
    next_month = forecast["months"][1]
    assert float(next_month["committed_expense"]) == pytest.approx(200.0)
    assert float(next_month["estimated_expense"]) == 0.0  # já coberto, não precisa de estimativa


@pytest.mark.asyncio
async def test_expense_already_happened_this_month_is_not_double_counted(client):
    """current_balance já soma tudo até agora; o mesmo lançamento não pode
    também aparecer como 'comprometido' no mês corrente, senão o saldo
    projetado do próprio mês de hoje desconta a despesa duas vezes."""
    headers = (await register_and_login(client))["headers"]
    now = datetime.now(timezone.utc)
    account = (await client.post("/finance/accounts", json={"name": "Conta", "opening_balance": 2000}, headers=headers)).json()

    await client.post("/finance/transactions", headers=headers, json={
        "transaction_type": "expense", "amount": 500, "description": "Já pago",
        "bank_account_id": account["id"], "transaction_date": _iso(now),
    })

    forecast = (await client.get("/finance/forecast?months=2", headers=headers)).json()
    assert forecast["current_balance"] == "1500.00000000"
    this_month = forecast["months"][0]
    assert float(this_month["committed_expense"]) == 0.0
    assert float(this_month["balance_realistic"]) == pytest.approx(1500.0)


@pytest.mark.asyncio
async def test_installment_appears_as_committed_in_its_own_future_month(client):
    headers = (await register_and_login(client))["headers"]
    now = datetime.now(timezone.utc)

    await client.post("/finance/transactions", headers=headers, json={
        "transaction_type": "expense", "amount": 300, "installments": 3,
        "description": "Notebook", "transaction_date": _iso(now),
    })

    forecast = (await client.get("/finance/forecast?months=3", headers=headers)).json()
    # mês 0 = mês corrente (1ª parcela, já "aconteceu"); meses 1 e 2 têm as demais.
    assert float(forecast["months"][1]["committed_expense"]) == pytest.approx(100.0)
    assert float(forecast["months"][2]["committed_expense"]) == pytest.approx(100.0)


@pytest.mark.asyncio
async def test_one_off_outlier_does_not_inflate_the_estimate_via_median(client):
    """Um pagamento anual isolado não pode fazer a mediana mentir — é
    exatamente o caso que a mediana (em vez da média) existe para evitar."""
    headers = (await register_and_login(client))["headers"]
    now = datetime.now(timezone.utc)
    categories = (await client.get("/finance/categories", headers=headers)).json()
    category_id = next(c["id"] for c in categories if c["category_type"] == "expense")

    # 5 meses com gasto pequeno e estável, 1 mês com um outlier grande.
    for i in range(1, 7):
        month_date = _month_start(now) - relativedelta(months=i)
        amount = 3000 if i == 3 else 50
        await client.post("/finance/transactions", headers=headers, json={
            "transaction_type": "expense", "amount": amount, "category_id": category_id,
            "description": "Gasto recorrente", "transaction_date": _iso(month_date),
        })

    forecast = (await client.get("/finance/forecast?months=2", headers=headers)).json()
    # Mediana de [50,50,50,50,50,3000] = 50. Média seria ~525 — bem mais alta.
    assert float(forecast["months"][1]["estimated_expense"]) == pytest.approx(50.0)


@pytest.mark.asyncio
async def test_negative_from_flags_the_first_month_balance_goes_negative(client):
    headers = (await register_and_login(client))["headers"]
    now = datetime.now(timezone.utc)
    account = (await client.post("/finance/accounts", json={"name": "Conta", "opening_balance": 100}, headers=headers)).json()

    await client.post("/finance/transactions", headers=headers, json={
        "transaction_type": "expense", "amount": 500, "description": "Aluguel",
        "bank_account_id": account["id"], "transaction_date": _iso(now),
        "recurrence_rule": "FREQ=MONTHLY",
    })

    forecast = (await client.get("/finance/forecast?months=3", headers=headers)).json()
    assert forecast["negative_from"] is not None
    flagged = next(m for m in forecast["months"] if m["month"] == forecast["negative_from"])
    assert float(flagged["balance_realistic"]) < 0


@pytest.mark.asyncio
async def test_open_card_invoice_counts_as_committed_expense_in_its_due_month(client, db_session):
    import uuid as uuid_mod
    from src.cards.models import CreditCard, CardInvoice

    session = await register_and_login(client)
    headers = session["headers"]
    user_id = uuid_mod.UUID(session["user_id"])
    now = datetime.now(timezone.utc)
    due = (now + relativedelta(months=1)).date().replace(day=10)

    card = CreditCard(user_id=user_id, name="Cartão")
    db_session.add(card)
    await db_session.flush()
    invoice = CardInvoice(
        user_id=user_id, card_id=card.id,
        reference_month=due.replace(day=1), due_date=due,
        status="review", total_amount=750,
    )
    db_session.add(invoice)
    await db_session.commit()

    forecast = (await client.get("/finance/forecast?months=3", headers=headers)).json()
    due_month = f"{due.year:04d}-{due.month:02d}"
    matching = next(m for m in forecast["months"] if m["month"] == due_month)
    assert float(matching["committed_expense"]) == pytest.approx(750.0)


@pytest.mark.asyncio
async def test_forecast_scoped_to_a_single_account(client):
    headers = (await register_and_login(client))["headers"]
    a = (await client.post("/finance/accounts", json={"name": "A", "opening_balance": 100}, headers=headers)).json()
    b = (await client.post("/finance/accounts", json={"name": "B", "opening_balance": 900}, headers=headers)).json()

    scoped = (await client.get(f"/finance/forecast?account_id={a['id']}", headers=headers)).json()
    assert scoped["current_balance"] == "100.00000000"

    total = (await client.get("/finance/forecast", headers=headers)).json()
    assert total["current_balance"] == "1000.00000000"
