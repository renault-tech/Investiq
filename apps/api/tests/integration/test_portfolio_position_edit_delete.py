"""Editar/apagar posições e transações de investimento — a lacuna que não
existia: não dava para tirar um ativo cadastrado errado nem corrigir uma
transação lançada com o valor errado."""
import pytest

from .conftest import register_and_login


async def _create_portfolio_with_position(client, headers, ticker="PETR4"):
    portfolio = await client.post("/portfolios/", json={"name": "Carteira BR", "currency": "BRL"}, headers=headers)
    portfolio_id = portfolio.json()["id"]
    position = await client.post(
        f"/portfolios/{portfolio_id}/positions", json={"ticker": ticker}, headers=headers
    )
    return portfolio_id, position.json()["id"]


async def _buy(client, headers, position_id, quantity, unit_price, date="2026-01-15T12:00:00Z"):
    resp = await client.post(
        "/portfolios/transactions",
        json={
            "position_id": position_id, "transaction_type": "buy",
            "quantity": quantity, "unit_price": unit_price, "fees": 0, "fx_rate": 1,
            "transaction_date": date,
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


@pytest.mark.asyncio
async def test_apagar_posicao_sem_transacoes(client):
    session = await register_and_login(client)
    headers = session["headers"]
    portfolio_id, position_id = await _create_portfolio_with_position(client, headers)

    resp = await client.delete(f"/portfolios/positions/{position_id}", headers=headers)
    assert resp.status_code == 204

    summary = await client.get(f"/portfolios/{portfolio_id}/summary", headers=headers)
    assert summary.json()["positions"] == []


@pytest.mark.asyncio
async def test_apagar_posicao_apaga_as_transacoes_junto(client):
    session = await register_and_login(client)
    headers = session["headers"]
    portfolio_id, position_id = await _create_portfolio_with_position(client, headers)
    await _buy(client, headers, position_id, 100, 30)

    resp = await client.delete(f"/portfolios/positions/{position_id}", headers=headers)
    assert resp.status_code == 204

    summary = await client.get(f"/portfolios/{portfolio_id}/summary", headers=headers)
    assert summary.json()["positions"] == []


@pytest.mark.asyncio
async def test_nao_pode_apagar_posicao_de_outro_usuario(client):
    a = await register_and_login(client)
    b = await register_and_login(client)
    _, position_id = await _create_portfolio_with_position(client, a["headers"])

    resp = await client.delete(f"/portfolios/positions/{position_id}", headers=b["headers"])
    assert resp.status_code == 404

    summary = await client.get("/portfolios/", headers=a["headers"])
    assert summary.status_code == 200  # portfolio de A intacto


@pytest.mark.asyncio
async def test_editar_corretora_e_peso_alvo_da_posicao(client):
    session = await register_and_login(client)
    headers = session["headers"]
    _, position_id = await _create_portfolio_with_position(client, headers)

    resp = await client.patch(
        f"/portfolios/positions/{position_id}",
        json={"broker": "Clear", "target_weight": 0.25},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["broker"] == "Clear"
    assert body["target_weight"] == "0.25"


@pytest.mark.asyncio
async def test_editar_transacao_recalcula_a_posicao(client):
    session = await register_and_login(client)
    headers = session["headers"]
    portfolio_id, position_id = await _create_portfolio_with_position(client, headers)
    txn = await _buy(client, headers, position_id, 100, 30)

    # Corrige a quantidade digitada errada: 100 -> 200
    resp = await client.patch(
        f"/portfolios/transactions/{txn['id']}", json={"quantity": 200}, headers=headers
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["quantity"] == "200.00000000"

    summary = await client.get(f"/portfolios/{portfolio_id}/summary", headers=headers)
    position = summary.json()["positions"][0]
    assert position["quantity"] == "200.00000000"
    assert position["cost_basis_brl"] == "6000.00000000"  # 200 * 30


@pytest.mark.asyncio
async def test_apagar_uma_de_duas_compras_recalcula_media(client):
    session = await register_and_login(client)
    headers = session["headers"]
    portfolio_id, position_id = await _create_portfolio_with_position(client, headers)
    buy1 = await _buy(client, headers, position_id, 100, 30, date="2026-01-01T12:00:00Z")
    await _buy(client, headers, position_id, 50, 32, date="2026-02-01T12:00:00Z")

    resp = await client.delete(f"/portfolios/transactions/{buy1['id']}", headers=headers)
    assert resp.status_code == 204

    summary = await client.get(f"/portfolios/{portfolio_id}/summary", headers=headers)
    position = summary.json()["positions"][0]
    assert position["quantity"] == "50.00000000"
    assert position["avg_cost"] == "32.00000000"


@pytest.mark.asyncio
async def test_apagar_compra_que_uma_venda_depende_e_recusado(client):
    session = await register_and_login(client)
    headers = session["headers"]
    portfolio_id, position_id = await _create_portfolio_with_position(client, headers)
    buy1 = await _buy(client, headers, position_id, 100, 30, date="2026-01-01T12:00:00Z")
    sell = await client.post(
        "/portfolios/transactions",
        json={
            "position_id": position_id, "transaction_type": "sell",
            "quantity": 80, "unit_price": 35, "fees": 0, "fx_rate": 1,
            "transaction_date": "2026-02-01T12:00:00Z",
        },
        headers=headers,
    )
    assert sell.status_code == 201, sell.text

    resp = await client.delete(f"/portfolios/transactions/{buy1['id']}", headers=headers)
    assert resp.status_code == 409, resp.text

    # Nada mudou: a posição continua com os 20 restantes da compra original.
    summary = await client.get(f"/portfolios/{portfolio_id}/summary", headers=headers)
    position = summary.json()["positions"][0]
    assert position["quantity"] == "20.00000000"


@pytest.mark.asyncio
async def test_listar_transacoes_da_posicao_mais_recente_primeiro(client):
    session = await register_and_login(client)
    headers = session["headers"]
    _, position_id = await _create_portfolio_with_position(client, headers)
    await _buy(client, headers, position_id, 100, 30, date="2026-01-01T12:00:00Z")
    await _buy(client, headers, position_id, 50, 32, date="2026-03-01T12:00:00Z")

    resp = await client.get(f"/portfolios/positions/{position_id}/transactions", headers=headers)
    assert resp.status_code == 200
    dates = [t["transaction_date"] for t in resp.json()]
    assert dates == sorted(dates, reverse=True)
    assert len(resp.json()) == 2


@pytest.mark.asyncio
async def test_nao_pode_listar_transacoes_de_posicao_de_outro_usuario(client):
    a = await register_and_login(client)
    b = await register_and_login(client)
    _, position_id = await _create_portfolio_with_position(client, a["headers"])

    resp = await client.get(f"/portfolios/positions/{position_id}/transactions", headers=b["headers"])
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_nao_pode_editar_transacao_de_outro_usuario(client):
    a = await register_and_login(client)
    b = await register_and_login(client)
    _, position_id = await _create_portfolio_with_position(client, a["headers"])
    txn = await _buy(client, a["headers"], position_id, 100, 30)

    resp = await client.patch(
        f"/portfolios/transactions/{txn['id']}", json={"quantity": 999}, headers=b["headers"]
    )
    assert resp.status_code == 404
