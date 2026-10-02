"""Integration: Central de Ações — inbox agregado e priorizado."""
from dateutil.relativedelta import relativedelta
from datetime import date, timedelta

import pytest

from .conftest import register_and_login


def _iso(days_from_today: int) -> str:
    return (date.today() + timedelta(days=days_from_today)).isoformat() + "T12:00:00Z"


async def _bill(client, headers, *, amount, description, due_in_days):
    """Conta a pagar em aberto. Vencimento no passado nasce marcado como pago
    (create_transaction assume `paid = due <= now`), então é preciso desmarcar
    para ter uma conta de fato vencida e em aberto — que é o caso que a
    Central de Ações prioriza no topo."""
    res = await client.post(
        "/finance/transactions",
        json={
            "transaction_type": "expense",
            "amount": amount,
            "description": description,
            "transaction_date": _iso(due_in_days),
            "due_date": _iso(due_in_days),
        },
        headers=headers,
    )
    assert res.status_code == 201, res.text
    created = res.json()
    if created["is_paid"]:
        unpaid = await client.post(f"/finance/transactions/{created['id']}/unpay", headers=headers)
        assert unpaid.status_code == 200, unpaid.text
        return unpaid.json()
    return created


@pytest.mark.asyncio
async def test_action_center_is_empty_without_pending_items(client):
    session = await register_and_login(client)
    res = await client.get("/actions", headers=session["headers"])
    assert res.status_code == 200, res.text
    assert res.json() == {"items": [], "total_amount": "0"}


@pytest.mark.asyncio
async def test_overdue_bill_outranks_a_larger_one_that_is_merely_due(client):
    """A regressão que isto trava: somar peso de urgência com valor deixava
    uma conta a vencer de R$ 5.000 acima de uma VENCIDA de R$ 1.000."""
    session = await register_and_login(client)
    headers = session["headers"]
    await _bill(client, headers, amount=5000, description="Grande a vencer", due_in_days=5)
    await _bill(client, headers, amount=1000, description="Pequena vencida", due_in_days=-2)

    res = await client.get("/actions", headers=headers)
    items = res.json()["items"]

    assert [i["title"] for i in items] == ["Pequena vencida", "Grande a vencer"]
    assert items[0]["kind"] == "bill_overdue"
    assert items[1]["kind"] == "bill_due"
    assert res.json()["total_amount"] == "6000.00000000"


@pytest.mark.asyncio
async def test_same_urgency_orders_by_due_date_then_amount(client):
    session = await register_and_login(client)
    headers = session["headers"]
    await _bill(client, headers, amount=10, description="Depois", due_in_days=6)
    await _bill(client, headers, amount=20, description="Antes menor", due_in_days=1)
    await _bill(client, headers, amount=900, description="Antes maior", due_in_days=1)

    items = (await client.get("/actions", headers=headers)).json()["items"]
    # prazo mais curto primeiro; empatado no prazo, maior valor primeiro
    assert [i["title"] for i in items] == ["Antes maior", "Antes menor", "Depois"]


@pytest.mark.asyncio
async def test_bills_beyond_the_horizon_are_left_out(client):
    session = await register_and_login(client)
    headers = session["headers"]
    await _bill(client, headers, amount=100, description="Longe", due_in_days=30)
    await _bill(client, headers, amount=100, description="Perto", due_in_days=3)

    items = (await client.get("/actions", headers=headers)).json()["items"]
    assert [i["title"] for i in items] == ["Perto"]


@pytest.mark.asyncio
async def test_paid_bill_does_not_show_up(client):
    session = await register_and_login(client)
    headers = session["headers"]
    bill = await _bill(client, headers, amount=100, description="Já paga", due_in_days=-1)
    await client.post(f"/finance/transactions/{bill['id']}/pay", headers=headers)

    items = (await client.get("/actions", headers=headers)).json()["items"]
    assert items == []


@pytest.mark.asyncio
async def test_recurring_bill_shows_up_even_after_the_template_was_paid(client):
    """Uma despesa recorrente tem UMA linha real (o template); as ocorrências
    seguintes existem virtualmente até alguém pagar ou editar. Lendo a tabela
    crua, uma recorrência cujo template já foi pago sumia do inbox para
    sempre — justamente a classe de conta que um inbox de vencimentos
    precisa mostrar."""
    session = await register_and_login(client)
    headers = session["headers"]

    # Template vencido há ~1 mês, mensal: a próxima ocorrência cai daqui a
    # 3 dias. "Há 30 dias" fazia a ocorrência cair HOJE nos meses de 30 dias
    # — e às 12:00 UTC, já passada à tarde, ela é estimada como paga e o
    # teste falhava conforme o dia/hora em que rodava.
    first_due = date.today() - relativedelta(months=1) + timedelta(days=3)
    created = await client.post(
        "/finance/transactions",
        json={
            "transaction_type": "expense",
            "amount": 120,
            "description": "Assinatura mensal",
            "transaction_date": first_due.isoformat() + "T12:00:00Z",
            "due_date": first_due.isoformat() + "T12:00:00Z",
            "recurrence_rule": "RRULE:FREQ=MONTHLY",
        },
        headers=headers,
    )
    assert created.status_code == 201, created.text
    # O template nasce pago (vencimento no passado) — é esse o cenário.
    assert created.json()["is_paid"] is True

    items = (await client.get("/actions", headers=headers)).json()["items"]
    assinaturas = [i for i in items if i["title"] == "Assinatura mensal"]
    assert assinaturas, f"ocorrência virtual não apareceu no inbox: {items}"


@pytest.mark.asyncio
async def test_inbox_is_scoped_to_the_user(client):
    a = await register_and_login(client)
    b = await register_and_login(client)
    await _bill(client, a["headers"], amount=100, description="Só do A", due_in_days=1)

    assert (await client.get("/actions", headers=b["headers"])).json()["items"] == []
    assert len((await client.get("/actions", headers=a["headers"])).json()["items"]) == 1


@pytest.mark.asyncio
async def test_recurring_bill_due_today_stays_in_the_inbox_all_day(client):
    """A ocorrência virtual que vence HOJE (em qualquer horário) continua
    pendente até o fim do dia — antes virava "paga" assim que o horário do
    vencimento passava e sumia do inbox no próprio dia."""
    if date.today().day > 28:
        pytest.skip("RRULE mensal pula dias 29-31 em meses curtos — cenário não se aplica hoje")
    session = await register_and_login(client)
    headers = session["headers"]
    first_due = date.today() - relativedelta(months=1)
    created = await client.post(
        "/finance/transactions",
        json={
            "transaction_type": "expense",
            "amount": 50,
            "description": "Conta que vence hoje",
            # 00:01 UTC: o horário já passou quando o teste roda.
            "transaction_date": first_due.isoformat() + "T00:01:00Z",
            "due_date": first_due.isoformat() + "T00:01:00Z",
            "recurrence_rule": "RRULE:FREQ=MONTHLY",
        },
        headers=headers,
    )
    assert created.status_code == 201, created.text

    items = (await client.get("/actions", headers=headers)).json()["items"]
    hoje = [i for i in items if i["title"] == "Conta que vence hoje"]
    assert hoje and hoje[0]["description"] == "Vence hoje", items
