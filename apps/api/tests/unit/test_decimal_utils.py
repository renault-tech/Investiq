from decimal import Decimal
from src.shared.decimal_utils import (
    d,
    add,
    subtract,
    multiply,
    divide,
    percentage_of,
    pct_change,
    round_financial,
)


def test_d_converts_string():
    assert d("0.1") == Decimal("0.1")


def test_d_converts_int():
    assert d(5) == Decimal("5")


def test_d_converts_float_string_precisely():
    # The key test: no floating-point error
    assert add(d("0.1"), d("0.2")) == d("0.3")


def test_multiply_precise():
    assert multiply(d("2.5"), d("4")) == d("10.00000000")


def test_divide_by_zero():
    assert divide(d("10"), d("0")) == d("0")


def test_divide_precise():
    result = divide(d("10"), d("3"))
    assert result == Decimal("3.33333333")


def test_percentage_of():
    assert percentage_of(d("50"), d("200")) == d("25.00000000")


def test_percentage_of_zero_total():
    assert percentage_of(d("50"), d("0")) == d("0")


def test_pct_change_gain():
    assert pct_change(d("110"), d("100")) == d("10.00000000")


def test_pct_change_loss():
    assert pct_change(d("90"), d("100")) == d("-10.00000000")


def test_round_financial():
    assert round_financial(d("1.005")) == d("1.01")


def test_round_financial_8_places():
    assert round_financial(d("1.123456789"), places=8) == d("1.12345679")
