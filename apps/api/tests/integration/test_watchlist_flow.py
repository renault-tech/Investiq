"""Watchlist — CRUD, isolamento entre usuários e degradação sem cotação."""
import pytest

from .conftest import register_and_login


@pytest.mark.asyncio
async def test_add_list_and_remove_watchlist_item(client):
    a = await register_and_login(client)

    created = await client.post("/watchlist", json={"ticker": "petr4"}, headers=a["headers"])
    assert created.status_code == 201
    body = created.json()
    assert body["ticker"] == "PETR4"
    assert body["name"] == "PETR4"
    item_id = body["id"]

    listed = await client.get("/watchlist", headers=a["headers"])
    assert listed.status_code == 200
    tickers = [item["ticker"] for item in listed.json()]
    assert tickers == ["PETR4"]
    # Sem provedor de mercado alcançável no ambiente de teste, o preço vem
    # nulo — a resposta não pode quebrar por causa disso.
    assert listed.json()[0]["price"] is None

    deleted = await client.delete(f"/watchlist/{item_id}", headers=a["headers"])
    assert deleted.status_code == 204

    empty = await client.get("/watchlist", headers=a["headers"])
    assert empty.json() == []


@pytest.mark.asyncio
async def test_adding_the_same_ticker_twice_conflicts(client):
    a = await register_and_login(client)

    first = await client.post("/watchlist", json={"ticker": "WEGE3"}, headers=a["headers"])
    assert first.status_code == 201

    second = await client.post("/watchlist", json={"ticker": "wege3"}, headers=a["headers"])
    assert second.status_code == 409


@pytest.mark.asyncio
async def test_watchlist_isolated_between_users(client):
    a = await register_and_login(client)
    b = await register_and_login(client)

    created = await client.post("/watchlist", json={"ticker": "VALE3"}, headers=a["headers"])
    item_id = created.json()["id"]

    b_list = await client.get("/watchlist", headers=b["headers"])
    assert b_list.json() == []

    b_delete = await client.delete(f"/watchlist/{item_id}", headers=b["headers"])
    assert b_delete.status_code == 404

    still_there = await client.get("/watchlist", headers=a["headers"])
    assert still_there.json()[0]["ticker"] == "VALE3"


@pytest.mark.asyncio
async def test_watchlist_reuses_existing_asset_from_a_portfolio_position(client):
    """Um ticker já em carteira (Asset já existe) não deve gerar duplicata
    ao ser adicionado à watchlist — mesma linha em `assets`, item novo só em
    `watchlist_items`."""
    a = await register_and_login(client)
    portfolio = await client.post("/portfolios/", json={"name": "P", "currency": "BRL"}, headers=a["headers"])
    portfolio_id = portfolio.json()["id"]
    await client.post(
        f"/portfolios/{portfolio_id}/positions", json={"ticker": "ITUB4"}, headers=a["headers"]
    )

    watchlisted = await client.post("/watchlist", json={"ticker": "ITUB4"}, headers=a["headers"])
    assert watchlisted.status_code == 201
    assert watchlisted.json()["ticker"] == "ITUB4"
