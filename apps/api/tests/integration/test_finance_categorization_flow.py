"""Integration: categorização automática — aprendizado por correção e sugestão via IA."""
import io

import pytest

from .conftest import register_and_login

OFX_TEMPLATE = """OFXHEADER:100
DATA:OFXSGML
VERSION:102

<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>{date}120000
<TRNAMT>-{amount}
<FITID>{fitid}
<MEMO>{memo}
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>
"""


def _ofx(fitid: str, date: str, amount: str, memo: str) -> bytes:
    return OFX_TEMPLATE.format(date=date, amount=amount, fitid=fitid, memo=memo).encode()


async def _upload(client, headers, content: bytes):
    files = {"file": ("extrato.ofx", io.BytesIO(content), "application/octet-stream")}
    return await client.post("/finance/import", headers=headers, files=files, data={})


async def _first_expense_category(client, headers) -> dict:
    categories = (await client.get("/finance/categories", headers=headers)).json()
    return next(c for c in categories if c["category_type"] == "expense")


async def _other_expense_category(client, headers, exclude_id: str) -> dict:
    categories = (await client.get("/finance/categories", headers=headers)).json()
    return next(c for c in categories if c["category_type"] == "expense" and c["id"] != exclude_id)


@pytest.mark.asyncio
async def test_manual_transaction_teaches_a_rule_that_prefills_a_later_import(client):
    headers = (await register_and_login(client))["headers"]
    category = await _first_expense_category(client, headers)

    created = await client.post("/finance/transactions", headers=headers, json={
        "transaction_type": "expense", "amount": 45.9,
        "description": "COMPRA CARTAO 1234 IFOOD *IFD",
        "category_id": category["id"], "transaction_date": "2026-06-01T12:00:00Z",
    })
    assert created.status_code == 201, created.text

    batch = (await _upload(
        client, headers, _ofx("fitid-teach-001", "20260620", "32.50", "COMPRA CARTAO 9988 IFOOD *IFD")
    )).json()
    assert batch["rows"][0]["category_id"] == category["id"]


@pytest.mark.asyncio
async def test_correcting_a_transaction_category_overrides_the_previous_rule(client):
    headers = (await register_and_login(client))["headers"]
    first = await _first_expense_category(client, headers)
    second = await _other_expense_category(client, headers, first["id"])

    txn = (await client.post("/finance/transactions", headers=headers, json={
        "transaction_type": "expense", "amount": 20,
        "description": "PADARIA DO ZE", "category_id": first["id"],
        "transaction_date": "2026-06-01T12:00:00Z",
    })).json()

    corrected = await client.patch(
        f"/finance/transactions/{txn['id']}", headers=headers, json={"category_id": second["id"]}
    )
    assert corrected.status_code == 200

    batch = (await _upload(
        client, headers, _ofx("fitid-correct-001", "20260625", "18.00", "PADARIA DO ZE")
    )).json()
    assert batch["rows"][0]["category_id"] == second["id"]


@pytest.mark.asyncio
async def test_setting_category_on_an_import_row_teaches_future_imports(client):
    headers = (await register_and_login(client))["headers"]
    category = await _first_expense_category(client, headers)

    batch = (await _upload(
        client, headers, _ofx("fitid-row-001", "20260601", "99.00", "POSTO SHELL CENTRO")
    )).json()
    row_id = batch["rows"][0]["id"]
    assert batch["rows"][0]["category_id"] is None  # ainda não existe regra para essa chave

    updated = await client.patch(
        f"/finance/import/rows/{row_id}", headers=headers, json={"category_id": category["id"]}
    )
    assert updated.status_code == 200

    second_batch = (await _upload(
        client, headers, _ofx("fitid-row-002", "20260610", "80.00", "POSTO SHELL CENTRO")
    )).json()
    assert second_batch["rows"][0]["category_id"] == category["id"]


@pytest.mark.asyncio
async def test_clearing_an_import_row_category_actually_clears_it(client):
    headers = (await register_and_login(client))["headers"]
    category = await _first_expense_category(client, headers)
    batch = (await _upload(
        client, headers, _ofx("fitid-clear-001", "20260601", "10.00", "LOJA QUALQUER")
    )).json()
    row_id = batch["rows"][0]["id"]

    await client.patch(
        f"/finance/import/rows/{row_id}", headers=headers, json={"category_id": category["id"]}
    )
    cleared = await client.patch(
        f"/finance/import/rows/{row_id}", headers=headers, json={"category_id": None}
    )
    assert cleared.status_code == 200
    assert cleared.json()["category_id"] is None


@pytest.mark.asyncio
async def test_learned_rules_are_isolated_per_user(client):
    a = await register_and_login(client)
    b = await register_and_login(client)
    category_a = await _first_expense_category(client, a["headers"])

    await client.post("/finance/transactions", headers=a["headers"], json={
        "transaction_type": "expense", "amount": 10,
        "description": "ACADEMIA SMART FIT", "category_id": category_a["id"],
        "transaction_date": "2026-06-01T12:00:00Z",
    })

    batch_b = (await _upload(
        client, b["headers"], _ofx("fitid-iso-001", "20260601", "10.00", "ACADEMIA SMART FIT"),
    )).json()
    assert batch_b["rows"][0]["category_id"] is None


class _FakeCategorizationProvider:
    """Stub LLMProvider — devolve uma sugestão determinística, sem rede."""
    name = "fake"
    default_model = "fake-1"

    async def complete(self, **kwargs):
        return '{"suggestions":[{"key":"MERCADO CENTRAL","category":"Alimentação"}]}'

    async def stream(self, **kwargs):  # pragma: no cover
        raise NotImplementedError


@pytest.mark.asyncio
async def test_ai_suggestion_endpoint_fills_unclassified_rows_and_learns(client, monkeypatch):
    monkeypatch.setattr(
        "src.finance.router.get_llm_provider", lambda **kwargs: _FakeCategorizationProvider()
    )
    headers = (await register_and_login(client))["headers"]
    batch = (await _upload(
        client, headers, _ofx("fitid-ai-001", "20260601", "55.00", "MERCADO CENTRAL")
    )).json()
    assert batch["rows"][0]["category_id"] is None

    result = await client.post(f"/finance/import/{batch['id']}/categorize-ai", headers=headers)
    assert result.status_code == 200, result.text
    row = result.json()["rows"][0]
    assert row["category_name"] == "Alimentação"

    # A sugestão aceita virou regra — a próxima importação já vem pronta sem
    # precisar chamar a IA de novo.
    monkeypatch.setattr(
        "src.finance.router.get_llm_provider",
        lambda **kwargs: (_ for _ in ()).throw(AssertionError("IA não deveria ser chamada de novo")),
    )
    second = (await _upload(
        client, headers, _ofx("fitid-ai-002", "20260610", "40.00", "MERCADO CENTRAL")
    )).json()
    assert second["rows"][0]["category_name"] == "Alimentação"
