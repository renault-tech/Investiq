"""Integration: upload de extrato, deduplicação, revisão e confirmação."""
import io

import pytest

from .conftest import register_and_login

OFX_SAMPLE = """OFXHEADER:100
DATA:OFXSGML
VERSION:102

<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260615120000
<TRNAMT>-45.90
<FITID>fitid-001
<MEMO>COMPRA CARTAO IFOOD
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260601090000
<TRNAMT>3500.00
<FITID>fitid-002
<NAME>SALARIO EMPRESA
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>
"""

CSV_SAMPLE = "Data;Descrição;Valor\n10/06/2026;Padaria;-12,50\n"


async def _upload(client, headers, filename: str, content: bytes, account_id: str | None = None):
    data = {"bank_account_id": account_id} if account_id else {}
    files = {"file": (filename, io.BytesIO(content), "application/octet-stream")}
    return await client.post("/finance/import", headers=headers, files=files, data=data)


@pytest.mark.asyncio
async def test_ofx_upload_creates_pending_batch_with_two_rows(client):
    headers = (await register_and_login(client))["headers"]
    res = await _upload(client, headers, "extrato.ofx", OFX_SAMPLE.encode())
    assert res.status_code == 201, res.text
    batch = res.json()
    assert batch["status"] == "pending"
    assert batch["file_type"] == "ofx"
    assert len(batch["rows"]) == 2
    assert all(not r["is_duplicate"] for r in batch["rows"])
    assert all(r["is_selected"] for r in batch["rows"])


@pytest.mark.asyncio
async def test_confirming_a_batch_creates_transactions_marked_as_imported(client):
    headers = (await register_and_login(client))["headers"]
    batch = (await _upload(client, headers, "extrato.ofx", OFX_SAMPLE.encode())).json()

    confirm = await client.post(f"/finance/import/{batch['id']}/confirm", headers=headers)
    assert confirm.status_code == 200, confirm.text
    assert confirm.json() == {"created": 2, "skipped": 0}

    listing = await client.get(
        "/finance/transactions",
        headers=headers,
        params={"date_from": "2026-01-01T00:00:00Z", "date_to": "2026-12-31T23:59:59Z"},
    )
    items = listing.json()["items"]
    assert len(items) == 2
    assert all(i["source"] == "import_ofx" for i in items)

    # Confirmar de novo é bloqueado — o lote já não está mais pendente.
    again = await client.post(f"/finance/import/{batch['id']}/confirm", headers=headers)
    assert again.status_code == 409


@pytest.mark.asyncio
async def test_reimporting_the_same_ofx_flags_exact_duplicates_and_skips_them(client):
    headers = (await register_and_login(client))["headers"]
    first = (await _upload(client, headers, "extrato.ofx", OFX_SAMPLE.encode())).json()
    await client.post(f"/finance/import/{first['id']}/confirm", headers=headers)

    second = (await _upload(client, headers, "extrato.ofx", OFX_SAMPLE.encode())).json()
    assert all(r["is_duplicate"] for r in second["rows"])
    assert all(not r["is_selected"] for r in second["rows"])

    confirm = await client.post(f"/finance/import/{second['id']}/confirm", headers=headers)
    # Nenhuma linha selecionada -> nada é criado.
    assert confirm.json() == {"created": 0, "skipped": 2}

    listing = await client.get(
        "/finance/transactions",
        headers=headers,
        params={"date_from": "2026-01-01T00:00:00Z", "date_to": "2026-12-31T23:59:59Z"},
    )
    assert len(listing.json()["items"]) == 2  # ainda só as do primeiro lote


@pytest.mark.asyncio
async def test_review_screen_can_toggle_selection_and_set_category(client):
    headers = (await register_and_login(client))["headers"]
    categories = (await client.get("/finance/categories", headers=headers)).json()
    expense_category = next(c["id"] for c in categories if c["category_type"] == "expense")

    batch = (await _upload(client, headers, "extrato.ofx", OFX_SAMPLE.encode())).json()
    ifood_row = next(r for r in batch["rows"] if "IFOOD" in r["description"])

    updated = await client.patch(
        f"/finance/import/rows/{ifood_row['id']}",
        headers=headers,
        json={"category_id": expense_category, "is_selected": False},
    )
    assert updated.status_code == 200
    assert updated.json()["category_id"] == expense_category
    assert updated.json()["is_selected"] is False

    confirm = await client.post(f"/finance/import/{batch['id']}/confirm", headers=headers)
    assert confirm.json() == {"created": 1, "skipped": 1}  # a linha desmarcada não vira transação


@pytest.mark.asyncio
async def test_csv_upload_with_ptbr_headers(client):
    headers = (await register_and_login(client))["headers"]
    res = await _upload(client, headers, "extrato.csv", CSV_SAMPLE.encode())
    assert res.status_code == 201, res.text
    batch = res.json()
    assert batch["file_type"] == "csv"
    assert len(batch["rows"]) == 1
    assert batch["rows"][0]["transaction_type"] == "expense"
    assert float(batch["rows"][0]["amount"]) == 12.5


@pytest.mark.asyncio
async def test_discard_batch_creates_nothing(client):
    headers = (await register_and_login(client))["headers"]
    batch = (await _upload(client, headers, "extrato.ofx", OFX_SAMPLE.encode())).json()

    discarded = await client.delete(f"/finance/import/{batch['id']}", headers=headers)
    assert discarded.status_code == 204

    missing = await client.get(f"/finance/import/{batch['id']}", headers=headers)
    assert missing.status_code == 404


@pytest.mark.asyncio
async def test_import_is_isolated_per_user(client):
    a = await register_and_login(client)
    b = await register_and_login(client)
    batch = (await _upload(client, a["headers"], "extrato.ofx", OFX_SAMPLE.encode())).json()

    forbidden = await client.get(f"/finance/import/{batch['id']}", headers=b["headers"])
    assert forbidden.status_code == 404


@pytest.mark.asyncio
async def test_upload_rejects_unrecognized_file(client):
    headers = (await register_and_login(client))["headers"]
    res = await _upload(client, headers, "notas.txt", b"isso nao e um extrato de verdade")
    assert res.status_code == 422
