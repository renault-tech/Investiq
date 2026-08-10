"""Integration: cross-user data isolation.

bank_accounts and finance_category_rules were both added after the note
below was written (Bloco 1 and Bloco 5 of the personal-finance roadmap) and
follow the same posture: RLS policies exist in the migrations but isolation
is enforced at the application layer, verified here the same way as every
other finance table.

NOTE on RLS: migrations 0002-0006 enable Postgres Row-Level Security with
policies keyed on current_setting('app.current_user_id'), but no code in this
codebase ever executes `SET app.current_user_id` on the session — so those
policies are currently inert (the app connects as a normal role and the
setting is always NULL, which a superuser bypasses entirely and a non-bypass
role would see as "zero rows" instead of enforcing anything meaningful).
Isolation today is enforced entirely at the application layer: every service
function filters `WHERE user_id == current_user.id` and/or raises
NotFoundError/ForbiddenError. These tests verify THAT property, since it's
what actually protects user data right now. Wiring the DB session to set
app.current_user_id per-request (as defense in depth) is a follow-up
hardening task, not yet implemented.
"""
import io

import pytest

from .conftest import register_and_login


@pytest.mark.asyncio
async def test_user_cannot_read_another_users_portfolio(client):
    a = await register_and_login(client)
    b = await register_and_login(client)

    portfolio = await client.post("/portfolios/", json={"name": "A's portfolio", "currency": "BRL"}, headers=a["headers"])
    portfolio_id = portfolio.json()["id"]

    forbidden = await client.get(f"/portfolios/{portfolio_id}/summary", headers=b["headers"])
    assert forbidden.status_code == 403


@pytest.mark.asyncio
async def test_portfolio_listing_is_scoped_per_user(client):
    a = await register_and_login(client)
    b = await register_and_login(client)

    await client.post("/portfolios/", json={"name": "A1", "currency": "BRL"}, headers=a["headers"])
    await client.post("/portfolios/", json={"name": "A2", "currency": "BRL"}, headers=a["headers"])

    a_list = await client.get("/portfolios/", headers=a["headers"])
    b_list = await client.get("/portfolios/", headers=b["headers"])
    assert len(a_list.json()) == 2
    assert b_list.json() == []


@pytest.mark.asyncio
async def test_user_cannot_delete_another_users_portfolio(client):
    a = await register_and_login(client)
    b = await register_and_login(client)

    portfolio = await client.post("/portfolios/", json={"name": "A's portfolio", "currency": "BRL"}, headers=a["headers"])
    portfolio_id = portfolio.json()["id"]

    delete = await client.delete(f"/portfolios/{portfolio_id}", headers=b["headers"])
    assert delete.status_code in (403, 404)

    still_there = await client.get("/portfolios/", headers=a["headers"])
    assert len(still_there.json()) == 1


@pytest.mark.asyncio
async def test_finance_categories_are_seeded_and_scoped_per_user(client):
    a = await register_and_login(client)
    b = await register_and_login(client)

    a_categories = await client.get("/finance/categories", headers=a["headers"])
    b_categories = await client.get("/finance/categories", headers=b["headers"])
    assert len(a_categories.json()) > 0
    assert len(b_categories.json()) == len(a_categories.json())

    a_ids = {c["id"] for c in a_categories.json()}
    b_ids = {c["id"] for c in b_categories.json()}
    assert a_ids.isdisjoint(b_ids)  # each user got their own seeded rows


@pytest.mark.asyncio
async def test_finance_transaction_isolated_between_users(client):
    a = await register_and_login(client)
    b = await register_and_login(client)

    txn = await client.post(
        "/finance/transactions",
        json={"transaction_type": "expense", "amount": 50, "transaction_date": "2026-07-01T12:00:00Z"},
        headers=a["headers"],
    )
    assert txn.status_code == 201
    txn_id = txn.json()["id"]

    b_edit = await client.patch(f"/finance/transactions/{txn_id}", json={"amount": 1}, headers=b["headers"])
    assert b_edit.status_code == 404

    b_list = await client.get("/finance/transactions", headers=b["headers"])
    assert b_list.json()["total"] == 0


@pytest.mark.asyncio
async def test_bank_account_isolated_between_users(client):
    a = await register_and_login(client)
    b = await register_and_login(client)

    account = await client.post("/finance/accounts", json={"name": "Nubank"}, headers=a["headers"])
    assert account.status_code == 201
    account_id = account.json()["id"]

    b_list = await client.get("/finance/accounts", headers=b["headers"])
    assert b_list.json() == []

    b_update = await client.patch(
        f"/finance/accounts/{account_id}", json={"name": "Hijacked"}, headers=b["headers"]
    )
    assert b_update.status_code == 404

    b_delete = await client.delete(f"/finance/accounts/{account_id}", headers=b["headers"])
    assert b_delete.status_code == 404

    still_there = await client.get("/finance/accounts", headers=a["headers"])
    assert still_there.json()[0]["name"] == "Nubank"


@pytest.mark.asyncio
async def test_learned_category_rule_does_not_leak_to_another_user(client):
    """A corrige/lança "COMPRA CARTAO IFOOD" com uma categoria — isso grava
    uma regra aprendida (finance_category_rules) para a chave "IFOOD". B
    importa um extrato com a mesma descrição e não pode vir pré-categorizado
    com a regra de A: as regras são por usuário, como qualquer outra tabela
    de finanças."""
    a = await register_and_login(client)
    b = await register_and_login(client)

    a_categories = (await client.get("/finance/categories", headers=a["headers"])).json()
    alimentacao = next(c for c in a_categories if c["name"] == "Alimentação")

    learn = await client.post(
        "/finance/transactions",
        headers=a["headers"],
        json={
            "transaction_type": "expense", "amount": 45.90,
            "description": "COMPRA CARTAO IFOOD", "category_id": alimentacao["id"],
            "transaction_date": "2026-06-15T12:00:00Z",
        },
    )
    assert learn.status_code == 201

    csv_content = "Data;Descrição;Valor\n20/06/2026;COMPRA CARTAO IFOOD;-38,00\n"
    files = {"file": ("extrato.csv", io.BytesIO(csv_content.encode()), "text/csv")}
    upload = await client.post("/finance/import", headers=b["headers"], files=files)
    assert upload.status_code == 201, upload.text
    row = upload.json()["rows"][0]
    assert row["category_id"] is None
