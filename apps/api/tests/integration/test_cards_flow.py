"""Integration: card CRUD, invoice upload (mocked LLM) → review → confirm."""
import pytest

from .conftest import register_and_login


class _FakeLLMProvider:
    """Stub LLMProvider — deterministic JSON, no network calls."""
    name = "fake"
    default_model = "fake-1"

    async def complete(self, **kwargs):
        return (
            '{"items":['
            '{"description":"MERCADO SILVA","amount":152.30,"date":"2026-06-10",'
            '"installment_no":null,"installment_total":null,"suggested_category":"Alimentação"},'
            '{"description":"NETFLIX.COM","amount":39.90,"date":"2026-06-12",'
            '"installment_no":null,"installment_total":null,"suggested_category":"Assinaturas"}'
            '],"total":192.20,"due_date":"2026-07-10"}'
        )

    async def stream(self, **kwargs):  # pragma: no cover
        raise NotImplementedError


@pytest.fixture(autouse=True)
def _mock_llm_provider(monkeypatch):
    monkeypatch.setattr("src.cards.router.get_llm_provider", lambda **kwargs: _FakeLLMProvider())


async def _create_card(client, headers):
    res = await client.post(
        "/cards", json={"name": "Nubank", "brand": "mastercard", "last4": "1234"}, headers=headers
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


@pytest.mark.asyncio
async def test_invoice_upload_extracts_items_into_review_status(client):
    session = await register_and_login(client)
    headers = session["headers"]
    card_id = await _create_card(client, headers)

    files = {"file": ("fatura.csv", b"data;descricao;valor\n10/06;MERCADO SILVA;152.30\n", "text/csv")}
    res = await client.post(
        f"/cards/{card_id}/invoices",
        data={"reference_month": "2026-06-01"},
        files=files,
        headers=headers,
    )
    assert res.status_code == 201, res.text
    invoice = res.json()
    assert invoice["status"] == "review"
    assert invoice["total_amount"] == "192.20000000"

    detail = await client.get(f"/cards/invoices/{invoice['id']}", headers=headers)
    items = detail.json()["items"]
    assert len(items) == 2
    assert any(i["category_id"] is not None for i in items)  # matched "Alimentação"/"Assinaturas"


@pytest.mark.asyncio
async def test_confirm_creates_expense_transactions_and_is_idempotent(client):
    session = await register_and_login(client)
    headers = session["headers"]
    card_id = await _create_card(client, headers)

    files = {"file": ("fatura.csv", b"data;descricao;valor\n10/06;MERCADO SILVA;152.30\n", "text/csv")}
    upload = await client.post(
        f"/cards/{card_id}/invoices",
        data={"reference_month": "2026-06-01"},
        files=files,
        headers=headers,
    )
    invoice_id = upload.json()["id"]

    confirm = await client.post(f"/cards/invoices/{invoice_id}/confirm", headers=headers)
    assert confirm.status_code == 200
    assert confirm.json()["status"] == "confirmed"

    finance_list = await client.get("/finance/transactions", params={"per_page": 50}, headers=headers)
    descriptions = [i["description"] for i in finance_list.json()["items"]]
    assert any("MERCADO SILVA" in d for d in descriptions)

    second_confirm = await client.post(f"/cards/invoices/{invoice_id}/confirm", headers=headers)
    assert second_confirm.status_code == 409


@pytest.mark.asyncio
async def test_ignored_item_does_not_generate_transaction(client):
    session = await register_and_login(client)
    headers = session["headers"]
    card_id = await _create_card(client, headers)

    files = {"file": ("fatura.csv", b"data;descricao;valor\n10/06;X;1\n", "text/csv")}
    upload = await client.post(
        f"/cards/{card_id}/invoices", data={"reference_month": "2026-06-01"}, files=files, headers=headers
    )
    invoice_id = upload.json()["id"]
    detail = await client.get(f"/cards/invoices/{invoice_id}", headers=headers)
    item_id = detail.json()["items"][0]["id"]

    await client.patch(
        f"/cards/invoices/{invoice_id}/items/{item_id}", json={"is_ignored": True}, headers=headers
    )
    await client.post(f"/cards/invoices/{invoice_id}/confirm", headers=headers)

    finance_list = await client.get("/finance/transactions", params={"per_page": 50}, headers=headers)
    assert finance_list.json()["total"] == 1  # only the non-ignored item


@pytest.mark.asyncio
async def test_duplicate_invoice_for_same_card_and_month_is_rejected(client):
    session = await register_and_login(client)
    headers = session["headers"]
    card_id = await _create_card(client, headers)
    files = {"file": ("fatura.csv", b"data;descricao;valor\n10/06;X;1\n", "text/csv")}

    first = await client.post(
        f"/cards/{card_id}/invoices", data={"reference_month": "2026-06-01"}, files=files, headers=headers
    )
    assert first.status_code == 201
    second = await client.post(
        f"/cards/{card_id}/invoices", data={"reference_month": "2026-06-15"}, files=files, headers=headers
    )
    assert second.status_code == 409
