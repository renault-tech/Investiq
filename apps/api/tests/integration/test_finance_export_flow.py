"""Integration: exportação CSV enriquecida e OFX."""
import pytest

from .conftest import register_and_login


@pytest.mark.asyncio
async def test_csv_export_includes_account_source_and_installment_columns(client):
    headers = (await register_and_login(client))["headers"]
    account = (await client.post(
        "/finance/accounts", json={"name": "Nubank"}, headers=headers
    )).json()

    await client.post("/finance/transactions", headers=headers, json={
        "transaction_type": "expense", "amount": 300, "installments": 3,
        "description": "Notebook", "bank_account_id": account["id"],
        "transaction_date": "2026-07-01T12:00:00Z",
    })

    res = await client.get("/finance/transactions/export", headers=headers)
    assert res.status_code == 200
    body = res.content.decode("utf-8-sig")
    header = body.splitlines()[0]
    assert header == "Data;Tipo;Descrição;Categoria;Valor;Moeda;Conta;Origem;Parcela"
    assert "Nubank" in body
    assert "Parcelamento" in body
    assert "1/3" in body


@pytest.mark.asyncio
async def test_csv_export_marks_manual_transactions(client):
    headers = (await register_and_login(client))["headers"]
    await client.post("/finance/transactions", headers=headers, json={
        "transaction_type": "expense", "amount": 10, "description": "Café",
        "transaction_date": "2026-07-01T12:00:00Z",
    })
    res = await client.get("/finance/transactions/export", headers=headers)
    assert "Manual" in res.content.decode("utf-8-sig")


@pytest.mark.asyncio
async def test_ofx_export_returns_a_file_the_import_parser_reads_back(client):
    headers = (await register_and_login(client))["headers"]
    await client.post("/finance/transactions", headers=headers, json={
        "transaction_type": "expense", "amount": 45.9, "description": "Ifood",
        "transaction_date": "2026-07-01T12:00:00Z",
    })
    await client.post("/finance/transactions", headers=headers, json={
        "transaction_type": "income", "amount": 3500, "description": "Salário",
        "transaction_date": "2026-07-05T12:00:00Z",
    })

    res = await client.get("/finance/transactions/export.ofx", headers=headers)
    assert res.status_code == 200
    assert "ofx" in res.headers["content-type"]

    from src.finance.import_parsers import parse_ofx
    parsed = parse_ofx(res.content.decode("utf-8"))
    assert len(parsed) == 2
    assert {r.transaction_type for r in parsed} == {"expense", "income"}
    expense = next(r for r in parsed if r.transaction_type == "expense")
    assert float(expense.amount) == pytest.approx(45.9)


@pytest.mark.asyncio
async def test_ofx_export_respects_date_filters(client):
    headers = (await register_and_login(client))["headers"]
    await client.post("/finance/transactions", headers=headers, json={
        "transaction_type": "expense", "amount": 10, "description": "Dentro",
        "transaction_date": "2026-07-15T12:00:00Z",
    })
    await client.post("/finance/transactions", headers=headers, json={
        "transaction_type": "expense", "amount": 20, "description": "Fora",
        "transaction_date": "2026-08-15T12:00:00Z",
    })

    res = await client.get(
        "/finance/transactions/export.ofx",
        params={"date_from": "2026-07-01T00:00:00Z", "date_to": "2026-07-31T23:59:59Z"},
        headers=headers,
    )
    from src.finance.import_parsers import parse_ofx
    parsed = parse_ofx(res.content.decode("utf-8"))
    assert len(parsed) == 1
    assert parsed[0].description == "Dentro"
