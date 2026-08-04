"""Unit tests for the CDI-compounding and point-in-time lookup helpers behind
GET /portfolios/{id}/benchmark (portfolio vs. CDI/Ibovespa)."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from datetime import date
from decimal import Decimal

from src.portfolio.service import _compound_index, _value_at


def test_compound_index_compounds_daily_rates():
    rates = [
        (date(2026, 1, 1), Decimal("0.05")),
        (date(2026, 1, 2), Decimal("0.05")),
    ]
    index = _compound_index(rates)
    assert index[0] == (date(2026, 1, 1), Decimal("1.0005"))
    assert index[1] == (date(2026, 1, 2), Decimal("1.0005") * Decimal("1.0005"))


def test_compound_index_sorts_out_of_order_input():
    rates = [
        (date(2026, 1, 2), Decimal("0.10")),
        (date(2026, 1, 1), Decimal("0.10")),
    ]
    index = _compound_index(rates)
    assert [d for d, _ in index] == [date(2026, 1, 1), date(2026, 1, 2)]


def test_compound_index_empty_input():
    assert _compound_index([]) == []


def test_value_at_returns_latest_on_or_before():
    series = [(date(2026, 1, 1), Decimal("1")), (date(2026, 1, 5), Decimal("2"))]
    assert _value_at(series, date(2026, 1, 3)) == Decimal("1")
    assert _value_at(series, date(2026, 1, 5)) == Decimal("2")
    assert _value_at(series, date(2026, 1, 10)) == Decimal("2")


def test_value_at_returns_none_before_first_point():
    series = [(date(2026, 1, 5), Decimal("2"))]
    assert _value_at(series, date(2026, 1, 1)) is None


def test_value_at_empty_series():
    assert _value_at([], date(2026, 1, 1)) is None
