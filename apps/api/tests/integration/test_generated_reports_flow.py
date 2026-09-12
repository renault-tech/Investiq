"""Integration: geração via os endpoints /reports/quick/* persiste em
generated_reports, aparece na listagem, pode ser rebaixada sem recalcular e
apagada — a tela de Relatórios depende disso pra mostrar histórico real em
vez de um calendário fixo."""
import pytest

from .conftest import register_and_login


@pytest.mark.asyncio
async def test_extrato_consolidado_fica_no_historico_e_pode_ser_rebaixado(client):
    headers = (await register_and_login(client))["headers"]
    await client.post("/finance/transactions", headers=headers, json={
        "transaction_type": "expense", "amount": 45.9, "description": "Ifood",
        "transaction_date": "2026-07-01T12:00:00Z",
    })

    gen = await client.get("/reports/quick/consolidated-statement", headers=headers)
    assert gen.status_code == 200
    original_body = gen.content

    listing = (await client.get("/reports/generated", headers=headers)).json()
    assert len(listing) == 1
    assert listing[0]["report_type"] == "consolidated_statement"
    assert listing[0]["format"] == "csv"
    assert listing[0]["file_size"] == len(original_body)

    report_id = listing[0]["id"]
    downloaded = await client.get(f"/reports/generated/{report_id}/download", headers=headers)
    assert downloaded.status_code == 200
    assert downloaded.content == original_body

    deleted = await client.delete(f"/reports/generated/{report_id}", headers=headers)
    assert deleted.status_code == 204
    listing_after = (await client.get("/reports/generated", headers=headers)).json()
    assert listing_after == []


@pytest.mark.asyncio
async def test_relatorio_fiscal_reflete_venda_tributavel_real(client):
    headers = (await register_and_login(client))["headers"]
    portfolio = (await client.post(
        "/portfolios/", headers=headers, json={"name": "Carteira"}
    )).json()
    position = (await client.post(
        f"/portfolios/{portfolio['id']}/positions", headers=headers,
        json={"ticker": "ZZZZ3", "asset_type": "stock_br"},
    )).json()
    await client.post("/portfolios/transactions", headers=headers, json={
        "position_id": position["id"], "transaction_type": "buy",
        "quantity": 2000, "unit_price": 10, "fees": 0,
        "transaction_date": "2026-01-05T12:00:00Z",
    })
    await client.post("/portfolios/transactions", headers=headers, json={
        "position_id": position["id"], "transaction_type": "sell",
        "quantity": 2000, "unit_price": 15, "fees": 0,
        "transaction_date": "2026-01-20T12:00:00Z",
    })

    res = await client.get("/reports/quick/tax-report", headers=headers, params={"year": 2026})
    assert res.status_code == 200
    body = res.content.decode("utf-8-sig")
    assert "1500,00000000" in body or "1500,0" in body  # 15% de 10.000 de ganho

    listing = (await client.get("/reports/generated", headers=headers)).json()
    assert any(r["report_type"] == "tax_report" for r in listing)


@pytest.mark.asyncio
async def test_relatorios_gerados_sao_isolados_por_usuario(client):
    headers_a = (await register_and_login(client))["headers"]
    await client.get("/reports/quick/consolidated-statement", headers=headers_a)

    headers_b = (await register_and_login(client))["headers"]
    listing_b = (await client.get("/reports/generated", headers=headers_b)).json()
    assert listing_b == []
