"""Unit tests for calculate_yield_on_cost (trailing-12m dividends / cost basis)."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from decimal import Decimal

from src.portfolio.calculations import calculate_yield_on_cost


def test_yield_on_cost_basic_ratio():
    result = calculate_yield_on_cost(Decimal("80"), Decimal("1000"))
    assert result == Decimal("0.08")


def test_yield_on_cost_zero_cost_basis_returns_zero_not_error():
    assert calculate_yield_on_cost(Decimal("50"), Decimal("0")) == Decimal("0")


def test_yield_on_cost_negative_cost_basis_returns_zero():
    assert calculate_yield_on_cost(Decimal("50"), Decimal("-100")) == Decimal("0")


def test_yield_on_cost_zero_dividends():
    assert calculate_yield_on_cost(Decimal("0"), Decimal("500")) == Decimal("0")
