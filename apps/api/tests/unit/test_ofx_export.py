"""Unit: geração de OFX de exportação (o par inverso do parser)."""
from datetime import datetime, timezone
from decimal import Decimal

from src.finance.import_parsers import parse_ofx
from src.finance.ofx_export import build_ofx_export


def _item(**overrides) -> dict:
    base = {
        "id": "b5f1c1a0-0000-4000-8000-000000000001",
        "transaction_type": "expense",
        "amount": Decimal("45.90"),
        "description": "Ifood",
        "category_name": "Alimentação",
        "transaction_date": datetime(2026, 6, 15, 12, 0, tzinfo=timezone.utc),
    }
    base.update(overrides)
    return base


def test_build_ofx_export_produces_a_file_the_parser_reads_back_correctly():
    items = [
        _item(),
        _item(
            id="b5f1c1a0-0000-4000-8000-000000000002",
            transaction_type="income",
            amount=Decimal("3500.00"),
            description="Salário",
            category_name=None,
        ),
    ]
    content = build_ofx_export(items)
    assert content.startswith('<?xml version="1.0"')
    assert "<OFX>" in content

    parsed = parse_ofx(content)
    assert len(parsed) == 2

    expense = next(r for r in parsed if r.transaction_type == "expense")
    assert expense.amount == Decimal("45.90")
    assert expense.description == "Ifood"

    income = next(r for r in parsed if r.transaction_type == "income")
    assert income.amount == Decimal("3500.00")


def test_build_ofx_export_handles_empty_list():
    content = build_ofx_export([])
    assert "<BANKTRANLIST>" in content
    assert "<STMTTRN>" not in content
