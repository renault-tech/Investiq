"""Integration: cross-user data isolation.

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
