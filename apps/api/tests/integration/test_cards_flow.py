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
async def test_invoice_upload_extracts_items_from_a_real_pdf(client):
    """Ponta a ponta pelo endpoint HTTP real, contra o mesmo _parse_pdf que
    devolvia "Suporte a PDF não instalado no servidor" em produção (Vercel)
    porque pdfplumber ficava de fora do bundle por peso — pypdf substitui e
    é pequeno o bastante para ir junto. O provider de IA aqui é o fake do
    fixture acima; o que este teste garante é que o PDF chega inteiro até
    ele como texto."""
    from fpdf import FPDF

    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("helvetica", size=12)
    pdf.cell(0, 8, "FATURA ITAU - JUNHO 2026", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 8, "10/06 MERCADO SILVA 152,30", new_x="LMARGIN", new_y="NEXT")
    content = bytes(pdf.output())

    session = await register_and_login(client)
    headers = session["headers"]
    card_id = await _create_card(client, headers)

    files = {"file": ("fatura.pdf", content, "application/pdf")}
    res = await client.post(
        f"/cards/{card_id}/invoices",
        data={"reference_month": "2026-06-01"},
        files=files,
        headers=headers,
    )
    assert res.status_code == 201, res.text
    invoice = res.json()
    assert invoice["status"] == "review"

    detail = await client.get(f"/cards/invoices/{invoice['id']}", headers=headers)
    assert len(detail.json()["items"]) == 2


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


@pytest.mark.asyncio
async def test_update_card_changes_name_and_limit(client):
    session = await register_and_login(client)
    headers = session["headers"]
    card_id = await _create_card(client, headers)

    resp = await client.patch(
        f"/cards/{card_id}", json={"name": "Nubank Platinum", "credit_limit": 8000}, headers=headers
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["name"] == "Nubank Platinum"
    assert body["credit_limit"] == "8000.00000000"
    assert body["last4"] == "1234"  # campo não enviado permanece intacto

    listed = await client.get("/cards", headers=headers)
    assert listed.json()[0]["name"] == "Nubank Platinum"


@pytest.mark.asyncio
async def test_cannot_update_card_of_another_user(client):
    a = await register_and_login(client)
    b = await register_and_login(client)
    card_id = await _create_card(client, a["headers"])

    resp = await client.patch(
        f"/cards/{card_id}", json={"name": "Roubado"}, headers=b["headers"]
    )
    assert resp.status_code == 404

    still_named = await client.get("/cards", headers=a["headers"])
    assert still_named.json()[0]["name"] == "Nubank"
