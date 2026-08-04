"""Unit tests for the monthly PDF report — formatting helpers and that the
generator produces a valid, non-trivial PDF for both populated and empty
data (no portfolios, no expenses)."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from decimal import Decimal

from src.reports.pdf_report import _fmt_brl, _fmt_pct, generate_monthly_report_pdf


def test_fmt_brl_uses_ptbr_separators():
    assert _fmt_brl(Decimal("1234.56")) == "R$ 1.234,56"


def test_fmt_brl_negative():
    assert _fmt_brl(Decimal("-42.10")) == "-R$ 42,10"


def test_fmt_brl_small_value_no_thousands_separator():
    assert _fmt_brl(Decimal("9.99")) == "R$ 9,99"


def test_fmt_pct_fraction_to_percent_string():
    assert _fmt_pct(Decimal("0.375")) == "37.5%"


def test_generate_report_with_data_produces_valid_pdf():
    finance_summary = {
        "income": Decimal("5000.00"), "expense": Decimal("3200.50"), "net": Decimal("1799.50"),
        "by_category": [
            {"category_name": "Moradia", "value": Decimal("1200.00"), "pct": Decimal("0.375")},
        ],
    }
    portfolios = [{
        "portfolio_name": "Principal",
        "total_invested_brl": Decimal("10000.00"),
        "total_market_value_brl": Decimal("11500.00"),
        "total_pnl_absolute": Decimal("1500.00"),
        "total_pnl_percent": Decimal("15.00"),
    }]
    pdf_bytes = generate_monthly_report_pdf(
        user_name="Teste", month="2026-07", finance_summary=finance_summary, portfolios=portfolios
    )
    assert pdf_bytes[:5] == b"%PDF-"
    assert len(pdf_bytes) > 1000


def test_generate_report_with_no_data_still_produces_valid_pdf():
    finance_summary = {"income": Decimal("0"), "expense": Decimal("0"), "net": Decimal("0"), "by_category": []}
    pdf_bytes = generate_monthly_report_pdf(
        user_name="Teste", month="2026-07", finance_summary=finance_summary, portfolios=[]
    )
    assert pdf_bytes[:5] == b"%PDF-"
