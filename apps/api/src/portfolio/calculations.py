"""Portfolio financial calculations engine.

All arithmetic uses Python Decimal — never float — to prevent precision errors.
"""
from decimal import Decimal
from typing import Optional


# Re-export helpers for use without importing decimal_utils directly
from src.shared.decimal_utils import (
    d,
    add,
    subtract,
    multiply,
    divide,
    pct_change,
    round_financial,
)

_ZERO = Decimal("0")
_ONE = Decimal("1")
_HUNDRED = Decimal("100")


# ---------------------------------------------------------------------------
# Core position calculations
# ---------------------------------------------------------------------------


def calculate_weighted_average_cost(
    current_qty: Decimal,
    current_avg_cost: Decimal,
    new_qty: Decimal,
    new_unit_price: Decimal,
    fees: Optional[Decimal] = None,
) -> Decimal:
    """Compute new weighted average cost after a BUY transaction.

    Formula: ((current_qty * current_avg_cost) + (new_qty * new_unit_price) + fees)
             / (current_qty + new_qty)
    """
    if new_qty <= _ZERO:
        raise ValueError(f"new_qty must be positive for a BUY; got {new_qty}")
    _fees = fees if fees is not None else _ZERO
    total_qty = add(current_qty, new_qty)
    if total_qty == _ZERO:
        return _ZERO

    current_cost = multiply(current_qty, current_avg_cost)
    new_cost = multiply(new_qty, new_unit_price)
    total_cost = add(add(current_cost, new_cost), _fees)
    return divide(total_cost, total_qty)


def calculate_position_pnl(
    quantity: Decimal,
    avg_cost: Decimal,
    current_price: Decimal,
) -> tuple[Decimal, Decimal]:
    """Calculate absolute and percentage P&L for a position.

    Returns:
        Tuple of (pnl_absolute, pnl_percent).
        pnl_absolute: (current_price - avg_cost) * quantity
        pnl_percent: (current_price / avg_cost - 1) * 100
    """
    if quantity == _ZERO:
        return _ZERO, _ZERO

    market_value = multiply(quantity, current_price)
    cost_basis = multiply(quantity, avg_cost)
    pnl_absolute = subtract(market_value, cost_basis)

    if avg_cost == _ZERO:
        pnl_percent = _ZERO
    else:
        pnl_percent = pct_change(current_price, avg_cost)

    return round_financial(pnl_absolute), round_financial(pnl_percent)


def calculate_market_value(quantity: Decimal, current_price: Decimal) -> Decimal:
    """Current market value of a position."""
    return round_financial(multiply(quantity, current_price))


def calculate_cost_basis(
    quantity: Decimal,
    avg_cost: Decimal,
    fees: Optional[Decimal] = None,
) -> Decimal:
    """Total amount invested (cost basis) for a position."""
    _fees = fees if fees is not None else _ZERO
    return round_financial(add(multiply(quantity, avg_cost), _fees))


# ---------------------------------------------------------------------------
# Portfolio-level calculations
# ---------------------------------------------------------------------------


def calculate_position_weight(
    position_market_value: Decimal,
    total_portfolio_value: Decimal,
) -> Decimal:
    """Position weight as a decimal fraction (0.0 to 1.0).

    Example: position_market_value=1000, total_portfolio_value=5000 → 0.2000
    """
    if total_portfolio_value == _ZERO:
        return _ZERO
    weight = divide(position_market_value, total_portfolio_value)
    return round_financial(weight, places=4)


def calculate_portfolio_summary(positions: list[dict]) -> dict:
    """Aggregate portfolio-level metrics from a list of position dicts.

    Each position dict must have keys:
        quantity (Decimal), avg_cost (Decimal), current_price (Decimal),
        fx_rate_to_brl (Decimal, default 1)

    Returns:
        {
            total_invested_brl: Decimal,
            total_market_value_brl: Decimal,
            total_pnl_absolute: Decimal,
            total_pnl_percent: Decimal,
        }
    """
    total_invested = _ZERO
    total_market_value = _ZERO

    for pos in positions:
        qty = d(pos["quantity"])
        avg_cost = d(pos["avg_cost"])
        current_price = d(pos["current_price"])
        fx_rate = d(pos.get("fx_rate_to_brl", _ONE))
        if fx_rate == _ZERO:
            raise ValueError(f"fx_rate_to_brl cannot be zero for position {pos.get('asset_id', '?')}")

        cost_brl = multiply(multiply(qty, avg_cost), fx_rate)
        mktval_brl = multiply(multiply(qty, current_price), fx_rate)

        total_invested = add(total_invested, cost_brl)
        total_market_value = add(total_market_value, mktval_brl)

    total_pnl_absolute = subtract(total_market_value, total_invested)

    if total_invested == _ZERO:
        total_pnl_percent = _ZERO
    else:
        total_pnl_percent = pct_change(total_market_value, total_invested)

    return {
        "total_invested_brl": round_financial(total_invested),
        "total_market_value_brl": round_financial(total_market_value),
        "total_pnl_absolute": round_financial(total_pnl_absolute),
        "total_pnl_percent": round_financial(total_pnl_percent),
    }


# ---------------------------------------------------------------------------
# Transaction amount calculation
# ---------------------------------------------------------------------------


def calculate_transaction_total(
    quantity: Decimal,
    unit_price: Decimal,
    fees: Decimal,
    fx_rate: Optional[Decimal] = None,
) -> Decimal:
    """Calculate total transaction amount in base currency (BRL).

    total_amount = (quantity * unit_price + fees) * fx_rate
    """
    _fx = fx_rate if fx_rate is not None else _ONE
    gross = add(multiply(quantity, unit_price), fees)
    return round_financial(multiply(gross, _fx))


# ---------------------------------------------------------------------------
# Rebalancing
# ---------------------------------------------------------------------------


def calculate_rebalance_suggestion(
    positions: list[dict],
    total_portfolio_value_brl: Decimal,
) -> list[dict]:
    """Calculate how many units to buy/sell to reach target weights.

    Each position dict must have keys:
        asset_id (str), ticker (str),
        quantity (Decimal), current_price (Decimal), fx_rate_to_brl (Decimal),
        target_weight (Decimal | None)   — 0.0–1.0 decimal fraction
        market_value_brl (Decimal)

    Returns:
        List of dicts with asset_id, ticker, current_weight, target_weight,
        current_value_brl, target_value_brl, delta_value_brl, delta_units, action.
        action is "buy" | "sell" | "hold".
    """
    if total_portfolio_value_brl == _ZERO:
        return []

    result = []
    for pos in positions:
        target_w = pos.get("target_weight")
        if target_w is None:
            continue

        target_weight = d(target_w)
        current_value_brl = d(pos["market_value_brl"])
        current_price = d(pos["current_price"])
        fx_rate = d(pos.get("fx_rate_to_brl", _ONE))
        if fx_rate == _ZERO:
            raise ValueError(f"fx_rate_to_brl cannot be zero for position {pos.get('asset_id', '?')}")

        current_weight = divide(current_value_brl, total_portfolio_value_brl)
        target_value_brl = multiply(total_portfolio_value_brl, target_weight)
        delta_value_brl = subtract(target_value_brl, current_value_brl)

        price_in_brl = multiply(current_price, fx_rate)
        if price_in_brl == _ZERO:
            delta_units = _ZERO
        else:
            delta_units = divide(delta_value_brl, price_in_brl)

        delta_units = round_financial(delta_units)

        if delta_value_brl > Decimal("0.01"):
            action = "buy"
        elif delta_value_brl < Decimal("-0.01"):
            action = "sell"
        else:
            action = "hold"

        result.append({
            "asset_id": pos["asset_id"],
            "ticker": pos["ticker"],
            "current_weight": round_financial(current_weight, places=4),
            "target_weight": round_financial(target_weight, places=4),
            "current_value_brl": round_financial(current_value_brl),
            "target_value_brl": round_financial(target_value_brl),
            "delta_value_brl": round_financial(delta_value_brl),
            "delta_units": delta_units,
            "action": action,
        })

    return result


# ---------------------------------------------------------------------------
# Fixed income helpers
# ---------------------------------------------------------------------------


def calculate_fixed_income_gross_return(
    principal: Decimal,
    annual_rate: Decimal,
    business_days: int,
) -> Decimal:
    """Compound daily interest: principal * (1 + annual_rate/100) ^ (business_days/252) - principal.

    Uses 252 business days (Brazilian market convention).
    NOTE: accepts BUSINESS days, not calendar days.
    Use `get_ir_rate` / `calculate_fixed_income_net_return` with CALENDAR days for tax.

    Args:
        principal: Initial investment amount.
        annual_rate: Annual rate in percent (e.g. 12.5 for 12.5% a.a.).
        business_days: Number of business days (252/year convention).

    Returns:
        Gross return (interest earned) as Decimal.
    """
    rate = divide(annual_rate, _HUNDRED)
    exponent = Decimal(business_days) / Decimal(252)
    # pow() with fractional exponent: convert via float then back to Decimal
    factor = Decimal(str(float(_ONE + rate) ** float(exponent)))
    gross_amount = multiply(principal, factor)
    return round_financial(subtract(gross_amount, principal))


IR_BRACKETS: list[tuple[Optional[int], Decimal]] = [
    (180, Decimal("22.5")),   # up to 180 days: 22.5%
    (360, Decimal("20.0")),   # 181–360 days: 20%
    (720, Decimal("17.5")),   # 361–720 days: 17.5%
    (None, Decimal("15.0")),  # 721+ days: 15%
]


def get_ir_rate(days: int) -> Decimal:
    """Return the applicable Brazilian income tax (IR) rate for fixed income.

    Args:
        days: Investment duration in calendar days.

    Returns:
        IR rate as a percentage (e.g. Decimal("22.5") for 22.5%).
    """
    for threshold, rate in IR_BRACKETS:
        # Last entry has threshold=None — acts as catch-all, always returns
        if threshold is None or days <= threshold:
            return rate
    # Unreachable: IR_BRACKETS ends with a catch-all (None threshold)
    return Decimal("15.0")  # pragma: no cover


def calculate_fixed_income_net_return(
    principal: Decimal,
    gross_return: Decimal,
    days: int,
    is_ir_exempt: bool = False,
) -> tuple[Decimal, Decimal]:
    """Calculate net return after IR (LCI/LCA/CRI/CRA are exempt).

    Args:
        principal: Initial investment.
        gross_return: Pre-tax interest earned.
        days: Calendar days invested.
        is_ir_exempt: True for LCI/LCA/CRI/CRA (exempt from IR).

    Returns:
        Tuple of (ir_amount, net_return).
    """
    if is_ir_exempt or gross_return <= _ZERO:
        return _ZERO, gross_return

    ir_rate = get_ir_rate(days)
    ir_amount = multiply(gross_return, divide(ir_rate, _HUNDRED))
    net_return = subtract(gross_return, ir_amount)
    return round_financial(ir_amount), round_financial(net_return)
