"""Unit tests for invoice AI extractor and file parser."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

import pytest
from decimal import Decimal

from src.cards.ai_extractor import (
    extract_invoice_items,
    InvoiceExtractionError,
    _strip_code_fences,
)
from src.cards.parser import parse_invoice_file, InvoiceParseError


class FakeProvider:
    """LLMProvider stub returning canned responses in order."""
    name = "fake"
    default_model = "fake-1"

    def __init__(self, responses):
        self._responses = list(responses)
        self.calls = 0

    async def complete(self, **kwargs):
        self.calls += 1
        return self._responses.pop(0)

    async def stream(self, **kwargs):  # pragma: no cover
        raise NotImplementedError


VALID_JSON = (
    '{"items":[{"description":"MERCADO X","amount":152.30,"date":"2026-06-10",'
    '"installment_no":null,"installment_total":null,"suggested_category":"Alimentação"}],'
    '"total":152.30,"due_date":"2026-07-10"}'
)

# Fatura longa estourando o max_tokens da resposta e cortando o JSON no meio
# de uma string — mesma assinatura do bug relatado em produção ("EOF while
# parsing a string"). O primeiro item está completo; o segundo, pela metade.
TRUNCATED_JSON = (
    '{"items":[{"description":"MERCADO X","amount":152.30,"date":"2026-06-10",'
    '"installment_no":null,"installment_total":null,"suggested_category":"Alimentação"},'
    '{"description":"BITT CONVEN'
)


@pytest.mark.asyncio
async def test_extractor_parses_valid_json():
    provider = FakeProvider([VALID_JSON])
    result = await extract_invoice_items(provider, None, "texto da fatura", ["Alimentação"])
    assert len(result.items) == 1
    assert result.items[0].amount == Decimal("152.30")
    assert result.items[0].suggested_category == "Alimentação"
    assert provider.calls == 1


@pytest.mark.asyncio
async def test_extractor_retries_once_on_invalid_json():
    provider = FakeProvider(["isso não é json", VALID_JSON])
    result = await extract_invoice_items(provider, None, "texto", ["Alimentação"])
    assert provider.calls == 2
    assert len(result.items) == 1


@pytest.mark.asyncio
async def test_extractor_fails_after_two_invalid_responses():
    provider = FakeProvider(["nada", "ainda nada"])
    with pytest.raises(InvoiceExtractionError):
        await extract_invoice_items(provider, None, "texto", [])


@pytest.mark.asyncio
async def test_extractor_salvages_items_from_a_response_truncated_by_max_tokens():
    provider = FakeProvider([TRUNCATED_JSON])
    result = await extract_invoice_items(provider, None, "texto", ["Alimentação"])
    assert provider.calls == 1  # recuperou sem precisar do retry corretivo
    assert len(result.items) == 1
    assert result.items[0].description == "MERCADO X"


@pytest.mark.asyncio
async def test_extractor_still_retries_when_truncation_leaves_no_complete_item():
    provider = FakeProvider(['{"items":[{"description":"BITT CONVEN', VALID_JSON])
    result = await extract_invoice_items(provider, None, "texto", ["Alimentação"])
    assert provider.calls == 2
    assert len(result.items) == 1


@pytest.mark.asyncio
async def test_extractor_strips_markdown_fences():
    provider = FakeProvider([f"```json\n{VALID_JSON}\n```"])
    result = await extract_invoice_items(provider, None, "texto", ["Alimentação"])
    assert len(result.items) == 1


def test_strip_code_fences_plain_text_passthrough():
    assert _strip_code_fences('{"a":1}') == '{"a":1}'


def test_parser_rejects_unknown_format():
    with pytest.raises(InvoiceParseError):
        parse_invoice_file("foto.png", b"\x89PNG....")


def test_parser_rejects_oversized_file():
    with pytest.raises(InvoiceParseError):
        parse_invoice_file("fatura.csv", b"x" * (6 * 1024 * 1024))


def test_parser_reads_latin1_csv():
    text = parse_invoice_file("fatura.csv", "data;descrição;valor\n10/06;Café;15,50".encode("latin-1"))
    assert "descri" in text and "15,50" in text


# --- PDF (pypdf) --------------------------------------------------------

def _make_pdf(lines: list[str], *, password: str | None = None) -> bytes:
    """PDF mínimo com texto real — fpdf2 já é dependência do projeto (relatórios),
    então gerar o arquivo de teste não pede nenhuma lib nova."""
    from fpdf import FPDF

    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("helvetica", size=12)
    for line in lines:
        pdf.cell(0, 8, line, new_x="LMARGIN", new_y="NEXT")
    if password:
        pdf.set_encryption(owner_password=password, user_password=password)
    return bytes(pdf.output())


def test_parser_extracts_text_from_a_real_pdf():
    content = _make_pdf(["INVESTIQ FATURA TESTE", "10/06 SUPERMERCADO 123,45"])
    text = parse_invoice_file("fatura.pdf", content)
    assert "INVESTIQ FATURA TESTE" in text
    assert "123,45" in text


def test_parser_detects_pdf_by_content_even_without_pdf_extension():
    # cards/upload.tsx (frontend) pode mandar um nome de arquivo genérico;
    # o parser decide pelo cabeçalho %PDF quando a extensão não ajuda.
    content = _make_pdf(["Conteúdo do teste"])
    text = parse_invoice_file("upload.bin", content)
    assert "Conteúdo do teste" in text


def test_parser_rejects_pdf_with_no_extractable_text():
    empty_pdf = _make_pdf([])
    with pytest.raises(InvoiceParseError, match="sem texto extraível"):
        parse_invoice_file("fatura.pdf", empty_pdf)


def test_parser_rejects_corrupted_pdf():
    with pytest.raises(InvoiceParseError, match="protegido ou corrompido"):
        parse_invoice_file("fatura.pdf", b"%PDF-1.4\nnot actually a valid pdf body")


def test_parser_reads_pdf_with_blank_owner_password():
    # Muitos apps de banco exportam a fatura com senha de dono em branco
    # (edição bloqueada, leitura livre) — extract_text() deve funcionar sem
    # o chamador precisar informar senha nenhuma.
    content = _make_pdf(["Fatura protegida", "05/07 FARMACIA 89,90"], password="")
    text = parse_invoice_file("fatura.pdf", content)
    assert "Fatura protegida" in text
