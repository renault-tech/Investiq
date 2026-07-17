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
