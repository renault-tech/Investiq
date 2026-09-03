"""Unit tests for calculations.py — regression coverage for a real bug found
by comparing a user's own added-up position values against the "Carteira
total" the app showed them: a foreign-currency portfolio's total was ~5x
the real number (matching the USD/BRL rate applied twice)."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from decimal import Decimal

from src.portfolio.calculations import calculate_portfolio_summary, calculate_rebalance_suggestion


def test_portfolio_summary_does_not_double_convert_foreign_currency():
    # get_portfolio_summary already converts current_price/avg_cost to BRL
    # before building this dict (see its own comment) — current_price here
    # is what the user actually sees as market_value_brl per position, not
    # a native-currency price fx_rate still needs applying to.
    positions = [
        # BRL position: quantity 100 @ R$30, no fx involved.
        {"quantity": Decimal("100"), "avg_cost": Decimal("25"), "current_price": Decimal("30")},
        # "Foreign" position: current_price is ALREADY the BRL-converted
        # price (e.g. $60 * 5.4 = R$324) — must not be multiplied by an fx
        # rate again.
        {"quantity": Decimal("10"), "avg_cost": Decimal("270"), "current_price": Decimal("324")},
    ]
    result = calculate_portfolio_summary(positions)
    # 100*30 + 10*324 = 3000 + 3240 = 6240 (not multiplied by any fx rate)
    assert result["total_market_value_brl"] == Decimal("6240.00")
    # 100*25 + 10*270 = 2500 + 2700 = 5200
    assert result["total_invested_brl"] == Decimal("5200.00")


def test_portfolio_summary_matches_sum_of_reported_position_values():
    # Regression for the exact real-world case: a portfolio entirely in USD
    # ETFs whose individual position values (shown in the table, computed
    # elsewhere with a single conversion) summed to ~R$82 mil, while the
    # "Carteira total" header — built from this function — showed ~R$422 mil,
    # roughly 5.16x higher, matching the USD/BRL rate of the day applied a
    # second time on top of already-converted prices.
    already_brl_market_values = [Decimal("29686.32"), Decimal("12873.17"), Decimal("12998.49"),
                                  Decimal("7677.46"), Decimal("18709.72")]
    positions = [
        {"quantity": Decimal("1"), "avg_cost": Decimal("0"), "current_price": v}
        for v in already_brl_market_values
    ]
    result = calculate_portfolio_summary(positions)
    assert result["total_market_value_brl"] == sum(already_brl_market_values)


def test_rebalance_suggestion_does_not_double_convert_foreign_currency():
    # current_price already BRL (R$324, e.g. $60 * 5.4) — delta_units must
    # divide by that as-is. Dividing by current_price * fx_rate again (the
    # bug) understated how many units to buy by roughly the fx rate itself.
    positions = [{
        "asset_id": "a1", "ticker": "VOO",
        "quantity": Decimal("10"), "current_price": Decimal("324"),
        "target_weight": Decimal("1.0"), "market_value_brl": Decimal("3240"),
    }]
    result = calculate_rebalance_suggestion(positions, total_portfolio_value_brl=Decimal("6480"))
    # Target is 100% of 6480 = 6480; currently holds 3240 -> delta 3240 BRL
    # -> 3240 / 324 = 10 units to buy.
    assert result[0]["action"] == "buy"
    assert result[0]["delta_units"] == Decimal("10.00")
