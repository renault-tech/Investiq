"""Resumo, análises e exportação escopados por conta ativa/titular — antes
só a listagem de transações e a projeção respeitavam account_id/holder;
resumo e análises ignoravam por completo, então clicar numa carteira não
mudava nada além da tabela."""
from datetime import datetime, timezone

import pytest

from .conftest import register_and_login


def _iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _account(client, headers, name: str, **extra) -> dict:
    res = await client.post("/finance/accounts", json={"name": name, **extra}, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()


async def _expense_category(client, headers) -> str:
    categories = (await client.get("/finance/categories", headers=headers)).json()
    return next(c["id"] for c in categories if c["category_type"] == "expense")


@pytest.mark.asyncio
async def test_summary_scoped_by_account_id_only_counts_that_account(client):
    headers = (await register_and_login(client))["headers"]
    category_id = await _expense_category(client, headers)
    nubank = await _account(client, headers, "Nubank")
    itau = await _account(client, headers, "Itaú")
    month = datetime.now(timezone.utc).strftime("%Y-%m")

    await client.post("/finance/transactions", headers=headers, json={
        "transaction_type": "expense", "amount": 100, "category_id": category_id,
        "bank_account_id": nubank["id"], "transaction_date": _iso(),
    })
    await client.post("/finance/transactions", headers=headers, json={
        "transaction_type": "expense", "amount": 250, "category_id": category_id,
        "bank_account_id": itau["id"], "transaction_date": _iso(),
    })

    consolidated = await client.get("/finance/summary", params={"month": month}, headers=headers)
    assert consolidated.json()["expense"] == "350.00000000"

    nubank_only = await client.get(
        "/finance/summary", params={"month": month, "account_id": nubank["id"]}, headers=headers
    )
    assert nubank_only.json()["expense"] == "100.00000000"

    itau_only = await client.get(
        "/finance/summary", params={"month": month, "account_id": itau["id"]}, headers=headers
    )
    assert itau_only.json()["expense"] == "250.00000000"


@pytest.mark.asyncio
async def test_summary_scoped_by_holder_groups_accounts(client):
    headers = (await register_and_login(client))["headers"]
    category_id = await _expense_category(client, headers)
    mine = await _account(client, headers, "Nubank Eu", holder="Eu")
    moms = await _account(client, headers, "Nubank Mãe", holder="Mãe")
    month = datetime.now(timezone.utc).strftime("%Y-%m")

    await client.post("/finance/transactions", headers=headers, json={
        "transaction_type": "expense", "amount": 60, "category_id": category_id,
        "bank_account_id": mine["id"], "transaction_date": _iso(),
    })
    await client.post("/finance/transactions", headers=headers, json={
        "transaction_type": "expense", "amount": 40, "category_id": category_id,
        "bank_account_id": moms["id"], "transaction_date": _iso(),
    })

    mine_only = await client.get(
        "/finance/summary", params={"month": month, "holder": "Eu"}, headers=headers
    )
    assert mine_only.json()["expense"] == "60.00000000"


@pytest.mark.asyncio
async def test_analytics_scoped_by_account_id(client):
    headers = (await register_and_login(client))["headers"]
    category_id = await _expense_category(client, headers)
    nubank = await _account(client, headers, "Nubank", opening_balance=1000)
    itau = await _account(client, headers, "Itaú", opening_balance=500)

    await client.post("/finance/transactions", headers=headers, json={
        "transaction_type": "expense", "amount": 300, "category_id": category_id,
        "bank_account_id": nubank["id"], "transaction_date": _iso(),
    })
    await client.post("/finance/transactions", headers=headers, json={
        "transaction_type": "expense", "amount": 100, "category_id": category_id,
        "bank_account_id": itau["id"], "transaction_date": _iso(),
    })

    consolidated = await client.get("/finance/analytics", params={"months": 3}, headers=headers)
    assert consolidated.status_code == 200

    scoped = await client.get(
        "/finance/analytics", params={"months": 3, "account_id": nubank["id"]}, headers=headers
    )
    assert scoped.status_code == 200

    # burn_rate olha só meses fechados (o mês corrente é parcial e fica de
    # fora por design), então o filtro se prova pelo mês corrente dentro de
    # savings_series: 300 (só Nubank) contra 400 (consolidado).
    def current_month_expense(payload: dict) -> str:
        return payload["savings_series"][-1]["expense"]

    assert current_month_expense(scoped.json()) == "300.00000000"
    assert current_month_expense(consolidated.json()) == "400.00000000"


@pytest.mark.asyncio
async def test_export_csv_respects_account_id(client):
    headers = (await register_and_login(client))["headers"]
    category_id = await _expense_category(client, headers)
    nubank = await _account(client, headers, "Nubank")
    itau = await _account(client, headers, "Itaú")

    await client.post("/finance/transactions", headers=headers, json={
        "transaction_type": "expense", "amount": 100, "category_id": category_id,
        "bank_account_id": nubank["id"], "description": "Compra Nubank", "transaction_date": _iso(),
    })
    await client.post("/finance/transactions", headers=headers, json={
        "transaction_type": "expense", "amount": 250, "category_id": category_id,
        "bank_account_id": itau["id"], "description": "Compra Itaú", "transaction_date": _iso(),
    })

    res = await client.get(
        "/finance/transactions/export", params={"account_id": nubank["id"]}, headers=headers
    )
    assert res.status_code == 200
    body = res.text
    assert "Compra Nubank" in body
    assert "Compra Itaú" not in body
