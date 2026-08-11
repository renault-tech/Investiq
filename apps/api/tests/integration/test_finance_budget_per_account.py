"""Orçamento por carteira.

Um teto por categoria valia para todas as contas somadas, então quem
administra a própria carteira e a de outra pessoa não conseguia limites
independentes — o gasto de uma estourava o orçamento da outra.
"""
from datetime import datetime, timezone

import pytest

from .conftest import register_and_login


def _this_month_date(day: int) -> str:
    now = datetime.now(timezone.utc)
    return now.replace(day=min(day, 28), hour=12, minute=0, second=0, microsecond=0).isoformat()


async def _first_expense_category(client, headers) -> str:
    categories = (await client.get("/finance/categories", headers=headers)).json()
    return next(c["id"] for c in categories if c["category_type"] == "expense")


async def _create_account(client, headers, name: str, holder: str) -> str:
    resp = await client.post(
        "/finance/accounts",
        json={"name": name, "holder": holder, "account_type": "checking", "opening_balance": 0},
        headers=headers,
    )
    assert resp.status_code in (200, 201), resp.text
    return resp.json()["id"]


async def _spend(client, headers, category_id: str, account_id: str, amount: int) -> None:
    resp = await client.post(
        "/finance/transactions",
        json={
            "transaction_type": "expense",
            "amount": amount,
            "category_id": category_id,
            "bank_account_id": account_id,
            "transaction_date": _this_month_date(5),
        },
        headers=headers,
    )
    assert resp.status_code in (200, 201), resp.text


@pytest.mark.asyncio
async def test_orcamento_de_uma_carteira_nao_ve_gasto_da_outra(client):
    session = await register_and_login(client)
    headers = session["headers"]
    category_id = await _first_expense_category(client, headers)
    minha = await _create_account(client, headers, "Nubank", "Eu")
    dela = await _create_account(client, headers, "Itaú", "Minha mãe")

    await client.put(
        "/finance/budgets",
        json={"category_id": category_id, "amount": 500, "bank_account_id": minha},
        headers=headers,
    )
    await client.put(
        "/finance/budgets",
        json={"category_id": category_id, "amount": 800, "bank_account_id": dela},
        headers=headers,
    )

    await _spend(client, headers, category_id, minha, 200)
    await _spend(client, headers, category_id, dela, 700)

    minha_budgets = (await client.get(f"/finance/budgets?account_id={minha}", headers=headers)).json()
    dela_budgets = (await client.get(f"/finance/budgets?account_id={dela}", headers=headers)).json()

    minha_budget = next(b for b in minha_budgets if b["category_id"] == category_id)
    dela_budget = next(b for b in dela_budgets if b["category_id"] == category_id)

    assert minha_budget["amount"] == "500.00000000"
    assert minha_budget["spent"] == "200.00000000"
    assert dela_budget["amount"] == "800.00000000"
    assert dela_budget["spent"] == "700.00000000"


@pytest.mark.asyncio
async def test_orcamento_consolidado_soma_todas_as_carteiras(client):
    session = await register_and_login(client)
    headers = session["headers"]
    category_id = await _first_expense_category(client, headers)
    minha = await _create_account(client, headers, "Nubank", "Eu")
    dela = await _create_account(client, headers, "Itaú", "Minha mãe")

    # Sem bank_account_id o orçamento é o consolidado.
    await client.put("/finance/budgets", json={"category_id": category_id, "amount": 1000}, headers=headers)

    await _spend(client, headers, category_id, minha, 200)
    await _spend(client, headers, category_id, dela, 700)

    consolidado = (await client.get("/finance/budgets", headers=headers)).json()
    budget = next(b for b in consolidado if b["category_id"] == category_id)

    assert budget["bank_account_id"] is None
    assert budget["spent"] == "900.00000000"


@pytest.mark.asyncio
async def test_consolidado_e_por_carteira_convivem_sem_colidir(client):
    """A unique é (user, categoria, conta) com NULLS NOT DISTINCT — sem isso,
    vários consolidados da mesma categoria conviveriam no banco."""
    session = await register_and_login(client)
    headers = session["headers"]
    category_id = await _first_expense_category(client, headers)
    minha = await _create_account(client, headers, "Nubank", "Eu")

    await client.put("/finance/budgets", json={"category_id": category_id, "amount": 1000}, headers=headers)
    await client.put("/finance/budgets", json={"category_id": category_id, "amount": 900}, headers=headers)
    await client.put(
        "/finance/budgets",
        json={"category_id": category_id, "amount": 500, "bank_account_id": minha},
        headers=headers,
    )

    consolidado = (await client.get("/finance/budgets", headers=headers)).json()
    da_carteira = (await client.get(f"/finance/budgets?account_id={minha}", headers=headers)).json()

    assert len([b for b in consolidado if b["category_id"] == category_id]) == 1
    assert next(b for b in consolidado if b["category_id"] == category_id)["amount"] == "900.00000000"
    assert next(b for b in da_carteira if b["category_id"] == category_id)["amount"] == "500.00000000"


@pytest.mark.asyncio
async def test_apagar_orcamento_de_uma_carteira_preserva_o_da_outra(client):
    session = await register_and_login(client)
    headers = session["headers"]
    category_id = await _first_expense_category(client, headers)
    minha = await _create_account(client, headers, "Nubank", "Eu")
    dela = await _create_account(client, headers, "Itaú", "Minha mãe")

    for account in (minha, dela):
        await client.put(
            "/finance/budgets",
            json={"category_id": category_id, "amount": 500, "bank_account_id": account},
            headers=headers,
        )

    deleted = await client.delete(f"/finance/budgets/{category_id}?account_id={minha}", headers=headers)
    assert deleted.status_code == 204

    minha_budgets = (await client.get(f"/finance/budgets?account_id={minha}", headers=headers)).json()
    dela_budgets = (await client.get(f"/finance/budgets?account_id={dela}", headers=headers)).json()

    assert [b for b in minha_budgets if b["category_id"] == category_id] == []
    assert len([b for b in dela_budgets if b["category_id"] == category_id]) == 1
