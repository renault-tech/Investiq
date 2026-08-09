"""Integration: contas com titular, saldo derivado, transferências e parcelamentos."""
from datetime import datetime, timedelta, timezone

import pytest

from .conftest import register_and_login


def _iso(days_from_now: int = 0) -> str:
    """Data ao meio-dia UTC, deslocada em dias — meio-dia evita que fuso
    horário empurre o lançamento para o dia (ou mês) vizinho."""
    moment = datetime.now(timezone.utc) + timedelta(days=days_from_now)
    return moment.replace(hour=12, minute=0, second=0, microsecond=0).isoformat()


async def _account(client, headers, name: str, **extra) -> dict:
    res = await client.post("/finance/accounts", json={"name": name, **extra}, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()


async def _first_expense_category(client, headers) -> str:
    categories = (await client.get("/finance/categories", headers=headers)).json()
    return next(c["id"] for c in categories if c["category_type"] == "expense")


# ---------------------------------------------------------------------------
# Contas
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_account_crud_and_duplicate_name_is_rejected(client):
    headers = (await register_and_login(client))["headers"]

    account = await _account(
        client, headers, "Nubank",
        account_type="checking", institution="Nu Pagamentos",
        holder="Eu", opening_balance=100,
    )
    assert account["holder"] == "Eu"
    assert account["balance"] == "100.00000000"

    duplicate = await client.post("/finance/accounts", json={"name": "Nubank"}, headers=headers)
    assert duplicate.status_code == 409

    renamed = await client.patch(
        f"/finance/accounts/{account['id']}", json={"holder": "Minha mãe"}, headers=headers
    )
    assert renamed.status_code == 200
    assert renamed.json()["holder"] == "Minha mãe"

    archived = await client.delete(f"/finance/accounts/{account['id']}", headers=headers)
    assert archived.status_code == 204
    assert (await client.get("/finance/accounts", headers=headers)).json() == []
    # Arquivar não apaga: a conta continua acessível com include_inactive.
    listing = await client.get("/finance/accounts?include_inactive=true", headers=headers)
    assert len(listing.json()) == 1


@pytest.mark.asyncio
async def test_accounts_are_isolated_per_user(client):
    a = await register_and_login(client)
    b = await register_and_login(client)
    await _account(client, a["headers"], "Conta do A")

    assert len((await client.get("/finance/accounts", headers=a["headers"])).json()) == 1
    assert (await client.get("/finance/accounts", headers=b["headers"])).json() == []


@pytest.mark.asyncio
async def test_balance_is_derived_from_transactions(client):
    headers = (await register_and_login(client))["headers"]
    account = await _account(client, headers, "Carteira", opening_balance=1000)

    await client.post("/finance/transactions", headers=headers, json={
        "transaction_type": "income", "amount": 500,
        "bank_account_id": account["id"], "transaction_date": _iso(),
    })
    await client.post("/finance/transactions", headers=headers, json={
        "transaction_type": "expense", "amount": 200,
        "bank_account_id": account["id"], "transaction_date": _iso(),
    })

    accounts = (await client.get("/finance/accounts", headers=headers)).json()
    assert accounts[0]["balance"] == "1300.00000000"   # 1000 + 500 - 200


@pytest.mark.asyncio
async def test_future_dated_transaction_does_not_move_todays_balance(client):
    """Parcela que ainda não venceu não pode inflar o saldo de hoje."""
    headers = (await register_and_login(client))["headers"]
    account = await _account(client, headers, "Conta", opening_balance=100)

    await client.post("/finance/transactions", headers=headers, json={
        "transaction_type": "income", "amount": 999,
        "bank_account_id": account["id"], "transaction_date": _iso(days_from_now=40),
    })

    accounts = (await client.get("/finance/accounts", headers=headers)).json()
    assert accounts[0]["balance"] == "100.00000000"


# ---------------------------------------------------------------------------
# Transferências
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_transfer_moves_balance_between_accounts_without_touching_the_summary(client):
    """O ponto central: transferir move dinheiro entre bolsos do mesmo dono —
    muda os dois saldos e não é receita nem despesa em lugar nenhum."""
    headers = (await register_and_login(client))["headers"]
    origin = await _account(client, headers, "Corrente", opening_balance=1000)
    destination = await _account(client, headers, "Poupança", opening_balance=0)

    month = datetime.now(timezone.utc).strftime("%Y-%m")
    before = (await client.get(f"/finance/summary?month={month}", headers=headers)).json()

    transfer = await client.post("/finance/transactions", headers=headers, json={
        "transaction_type": "transfer", "amount": 300,
        "bank_account_id": origin["id"], "to_bank_account_id": destination["id"],
        "transaction_date": _iso(),
    })
    assert transfer.status_code == 201, transfer.text

    accounts = {a["name"]: a for a in (await client.get("/finance/accounts", headers=headers)).json()}
    assert accounts["Corrente"]["balance"] == "700.00000000"
    assert accounts["Poupança"]["balance"] == "300.00000000"

    after = (await client.get(f"/finance/summary?month={month}", headers=headers)).json()
    assert after["income"] == before["income"]
    assert after["expense"] == before["expense"]


@pytest.mark.asyncio
async def test_transfer_requires_two_distinct_accounts(client):
    headers = (await register_and_login(client))["headers"]
    account = await _account(client, headers, "Única")

    missing = await client.post("/finance/transactions", headers=headers, json={
        "transaction_type": "transfer", "amount": 10,
        "bank_account_id": account["id"], "transaction_date": _iso(),
    })
    assert missing.status_code == 422

    same = await client.post("/finance/transactions", headers=headers, json={
        "transaction_type": "transfer", "amount": 10,
        "bank_account_id": account["id"], "to_bank_account_id": account["id"],
        "transaction_date": _iso(),
    })
    assert same.status_code == 422


@pytest.mark.asyncio
async def test_transfer_appears_in_the_ledger_of_both_accounts(client):
    headers = (await register_and_login(client))["headers"]
    origin = await _account(client, headers, "De")
    destination = await _account(client, headers, "Para")

    await client.post("/finance/transactions", headers=headers, json={
        "transaction_type": "transfer", "amount": 50,
        "bank_account_id": origin["id"], "to_bank_account_id": destination["id"],
        "transaction_date": _iso(),
    })

    for account_id in (origin["id"], destination["id"]):
        listing = await client.get(
            f"/finance/transactions?account_id={account_id}", headers=headers
        )
        assert listing.json()["total"] == 1


# ---------------------------------------------------------------------------
# Parcelamentos
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_installments_materialize_and_sum_exactly_to_the_total(client):
    headers = (await register_and_login(client))["headers"]
    account = await _account(client, headers, "Cartão")
    category_id = await _first_expense_category(client, headers)

    created = await client.post("/finance/transactions", headers=headers, json={
        "transaction_type": "expense", "amount": 1200, "installments": 12,
        "description": "Notebook", "category_id": category_id,
        "bank_account_id": account["id"], "transaction_date": _iso(),
    })
    assert created.status_code == 201, created.text
    assert created.json()["installment_no"] == 1
    assert created.json()["installment_total"] == 12
    assert float(created.json()["amount"]) == 100.0

    listing = await client.get(
        "/finance/transactions", headers=headers,
        params={"date_from": _iso(-1), "date_to": _iso(400)},
    )
    parcels = [i for i in listing.json()["items"] if i["description"] == "Notebook"]
    assert len(parcels) == 12
    assert sum(float(p["amount"]) for p in parcels) == pytest.approx(1200.0)
    # Parcela nunca é recorrente — é o que a mantém fora de expand_recurring.
    assert all(p["is_recurring"] is False for p in parcels)
    assert all(p["source"] == "installment" for p in parcels)


@pytest.mark.asyncio
async def test_uneven_installments_put_the_leftover_cents_in_the_last_one(client):
    headers = (await register_and_login(client))["headers"]
    created = await client.post("/finance/transactions", headers=headers, json={
        "transaction_type": "expense", "amount": 100, "installments": 3,
        "description": "Dividido em 3", "transaction_date": _iso(),
    })
    assert float(created.json()["amount"]) == 33.33

    listing = await client.get(
        "/finance/transactions", headers=headers,
        params={"date_from": _iso(-1), "date_to": _iso(200)},
    )
    parcels = sorted(
        (i for i in listing.json()["items"] if i["description"] == "Dividido em 3"),
        key=lambda i: i["installment_no"],
    )
    assert [float(p["amount"]) for p in parcels] == [33.33, 33.33, 33.34]


@pytest.mark.asyncio
async def test_deleting_an_installment_series_respects_the_requested_scope(client):
    headers = (await register_and_login(client))["headers"]
    created = await client.post("/finance/transactions", headers=headers, json={
        "transaction_type": "expense", "amount": 600, "installments": 6,
        "description": "Série", "transaction_date": _iso(),
    })
    first_id = created.json()["id"]

    # scope=one apaga só a parcela pedida
    assert (await client.delete(
        f"/finance/transactions/{first_id}?scope=one", headers=headers
    )).status_code == 204

    listing = await client.get(
        "/finance/transactions", headers=headers,
        params={"date_from": _iso(-1), "date_to": _iso(400)},
    )
    remaining = [i for i in listing.json()["items"] if i["description"] == "Série"]
    assert len(remaining) == 5

    # scope=all apaga o que sobrou da série
    assert (await client.delete(
        f"/finance/transactions/{remaining[0]['id']}?scope=all", headers=headers
    )).status_code == 204

    listing = await client.get(
        "/finance/transactions", headers=headers,
        params={"date_from": _iso(-1), "date_to": _iso(400)},
    )
    assert [i for i in listing.json()["items"] if i["description"] == "Série"] == []


@pytest.mark.asyncio
async def test_installments_and_recurrence_are_mutually_exclusive(client):
    headers = (await register_and_login(client))["headers"]
    res = await client.post("/finance/transactions", headers=headers, json={
        "transaction_type": "expense", "amount": 100, "installments": 3,
        "recurrence_rule": "FREQ=MONTHLY", "transaction_date": _iso(),
    })
    assert res.status_code == 422


# ---------------------------------------------------------------------------
# Filtro por titular
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_holder_filter_scopes_transactions_to_that_persons_accounts(client):
    headers = (await register_and_login(client))["headers"]
    mine = await _account(client, headers, "Minha conta", holder="Eu")
    hers = await _account(client, headers, "Conta da mãe", holder="Minha mãe")

    await client.post("/finance/transactions", headers=headers, json={
        "transaction_type": "expense", "amount": 10, "description": "Meu gasto",
        "bank_account_id": mine["id"], "transaction_date": _iso(),
    })
    await client.post("/finance/transactions", headers=headers, json={
        "transaction_type": "expense", "amount": 20, "description": "Gasto dela",
        "bank_account_id": hers["id"], "transaction_date": _iso(),
    })

    listing = await client.get("/finance/transactions?holder=Minha mãe", headers=headers)
    items = listing.json()["items"]
    assert len(items) == 1
    assert items[0]["description"] == "Gasto dela"
    assert items[0]["bank_account_name"] == "Conta da mãe"


@pytest.mark.asyncio
async def test_manual_entries_are_flagged_as_manual(client):
    """Lançamento digitado à mão precisa ser distinguível do importado."""
    headers = (await register_and_login(client))["headers"]
    created = await client.post("/finance/transactions", headers=headers, json={
        "transaction_type": "expense", "amount": 42, "description": "Digitado",
        "transaction_date": _iso(),
    })
    assert created.json()["source"] == "manual"
