"""Unit tests for decimal_utils — pure Python stdlib, no extra deps needed."""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from decimal import Decimal
from src.shared.decimal_utils import (
    d, add, subtract, multiply, divide,
    percentage_of, pct_change, round_financial,
)


def test_d_converts_string():
    assert d("0.1") + d("0.2") == d("0.3")


def test_d_converts_int():
    assert d(10) == Decimal("10")


def test_d_handles_invalid():
    assert d("not_a_number") == Decimal("0")


def test_multiply_precision():
    assert multiply(d("2.5"), d("4")) == d("10.00000000")


def test_divide_by_zero_returns_zero():
    assert divide(d("100"), d("0")) == d("0")


def test_divide_precise():
    result = divide(d("10"), d("3"))
    assert result == d("3.33333333")


def test_percentage_of():
    assert percentage_of(d("50"), d("200")) == d("25.00000000")


def test_pct_change_gain():
    assert pct_change(d("110"), d("100")) == d("10.00000000")


def test_pct_change_loss():
    result = pct_change(d("90"), d("100"))
    assert result == d("-10.00000000")


def test_round_financial_two_places():
    assert round_financial(d("1.005")) == d("1.01")
    assert round_financial(d("1.004")) == d("1.00")


def test_round_financial_eight_places():
    assert round_financial(d("1.123456789"), places=8) == d("1.12345679")
