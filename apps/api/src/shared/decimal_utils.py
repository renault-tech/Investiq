from decimal import Decimal, ROUND_HALF_UP, InvalidOperation

PRECISION = Decimal("0.00000001")  # 8 decimal places
DISPLAY_PRECISION = Decimal("0.01")  # 2 decimal places for display


def d(value) -> Decimal:
    """Convert any value to Decimal safely. Never use float arithmetic directly."""
    if isinstance(value, Decimal):
        return value
    try:
        return Decimal(str(value))
    except InvalidOperation:
        return Decimal("0")


def add(a: Decimal, b: Decimal) -> Decimal:
    return a + b


def subtract(a: Decimal, b: Decimal) -> Decimal:
    return a - b


def multiply(a: Decimal, b: Decimal) -> Decimal:
    return (a * b).quantize(PRECISION, rounding=ROUND_HALF_UP)


def divide(a: Decimal, b: Decimal) -> Decimal:
    if b == Decimal("0"):
        return Decimal("0")
    return (a / b).quantize(PRECISION, rounding=ROUND_HALF_UP)


def percentage_of(part: Decimal, total: Decimal) -> Decimal:
    """Returns what percentage of total is part (0-100 scale)."""
    if total == Decimal("0"):
        return Decimal("0")
    return multiply(divide(part, total), d("100"))


def pct_change(new_value: Decimal, old_value: Decimal) -> Decimal:
    """Returns percentage change from old to new."""
    if old_value == Decimal("0"):
        return Decimal("0")
    return multiply(divide(subtract(new_value, old_value), old_value), d("100"))


def round_financial(value: Decimal, places: int = 2) -> Decimal:
    """Round to financial display precision."""
    quantizer = Decimal("0.1") ** places
    return value.quantize(quantizer, rounding=ROUND_HALF_UP)
