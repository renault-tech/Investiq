"""Unit tests for performance helpers — date grid and allocation aggregation."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from datetime import date

from src.portfolio.service import _build_date_grid


def test_daily_grid_includes_bounds():
    grid = _build_date_grid(date(2026, 7, 1), date(2026, 7, 10), weekly=False)
    assert grid[0] == date(2026, 7, 1)
    assert grid[-1] == date(2026, 7, 10)
    assert len(grid) == 10


def test_weekly_grid_steps_seven_days_and_ends_today():
    grid = _build_date_grid(date(2026, 1, 1), date(2026, 1, 31), weekly=True)
    assert grid[0] == date(2026, 1, 1)
    assert grid[1] == date(2026, 1, 8)
    # last point is always the end date even if off-step
    assert grid[-1] == date(2026, 1, 31)


def test_single_day_grid():
    grid = _build_date_grid(date(2026, 7, 10), date(2026, 7, 10), weekly=False)
    assert grid == [date(2026, 7, 10)]


# ---------------------------------------------------------------------------
# TWR — robustez contra dado inconsistente
# ---------------------------------------------------------------------------

from decimal import Decimal

from src.portfolio.service import _compute_twr_series


def _point(day: int, value, invested):
    return {
        "date": date(2026, 7, day),
        "total_value": Decimal(str(value)),
        "total_invested": Decimal(str(invested)),
    }


def test_twr_ignores_contribution_and_measures_only_performance():
    # Aporta 1.000 no dia 2 sem o ativo se mexer: retorno tem que ficar em 0,
    # não virar +100% só porque o patrimônio dobrou.
    series = [_point(1, 1000, 1000), _point(2, 2000, 2000), _point(3, 2200, 2000)]
    out = _compute_twr_series(series)
    assert out[1]["twr_pct"] == Decimal("0")
    assert out[2]["twr_pct"] == Decimal("10")


def test_twr_never_flips_sign_on_an_impossible_sub_period():
    # Dia 2 com dado quebrado (o "investido" salta muito acima do valor de
    # mercado, como acontecia quando o custo estava em BRL e o valor em USD):
    # perder mais que 100% é impossível sem alavancagem. Antes isso
    # multiplicava o acumulado por um negativo e a série passava a oscilar
    # entre -450% e -1350% pra sempre.
    series = [_point(1, 1000, 1000), _point(2, 100, 6000), _point(3, 1100, 1000)]
    out = _compute_twr_series(series)
    assert all(point["twr_pct"] > Decimal("-100") for point in out)
    # O dia ilegível é pulado, não vira prejuízo: o dia 3 volta a medir sobre
    # a última base válida.
    assert out[2]["twr_pct"] == Decimal("10")


def test_twr_still_reports_a_real_loss():
    series = [_point(1, 1000, 1000), _point(2, 800, 1000)]
    out = _compute_twr_series(series)
    assert out[1]["twr_pct"] == Decimal("-20")


# ---------------------------------------------------------------------------
# _reconstruct_value_series — usado tanto pela reconstrução de uma carteira
# só quanto (somado por carteira) pela visão consolidada.
# ---------------------------------------------------------------------------

from src.portfolio.service import _reconstruct_value_series


class _FakeTxn:
    def __init__(self, transaction_type, quantity, total_amount):
        self.transaction_type = transaction_type
        self.quantity = Decimal(str(quantity))
        self.total_amount = Decimal(str(total_amount))


def test_reconstruct_value_series_prices_a_single_buy_in_foreign_currency():
    # 10 ações compradas por USD 500 total (fx não importa pro custo aqui,
    # só pro valor de mercado do dia).
    txns = [(date(2026, 1, 1), "AAPL", _FakeTxn("buy", 10, 500))]
    grid = [date(2026, 1, 1), date(2026, 1, 2)]
    closes = {"AAPL": {date(2026, 1, 1): Decimal("50"), date(2026, 1, 2): Decimal("55")}}
    fx = {date(2026, 1, 1): Decimal("5"), date(2026, 1, 2): Decimal("5.5")}

    out = _reconstruct_value_series(
        txns, grid,
        close_at=lambda ticker, day: closes[ticker][day],
        rate_at=lambda currency, day: fx[day],
        ticker_currency={"AAPL": "USD"},
    )
    # dia 1: 10 * 50 * 5 = 2500 ; dia 2: 10 * 55 * 5.5 = 3025
    assert out[0]["total_value"] == Decimal("2500")
    assert out[1]["total_value"] == Decimal("3025")
    assert out[0]["total_invested"] == Decimal("500")


def test_reconstruct_value_series_reduces_cost_proportionally_on_partial_sell():
    txns = [
        (date(2026, 1, 1), "PETR4", _FakeTxn("buy", 100, 1000)),
        (date(2026, 1, 2), "PETR4", _FakeTxn("sell", 40, 500)),
    ]
    grid = [date(2026, 1, 1), date(2026, 1, 2)]
    out = _reconstruct_value_series(
        txns, grid,
        close_at=lambda ticker, day: Decimal("10"),
        rate_at=lambda currency, day: Decimal("1"),
        ticker_currency={"PETR4": "BRL"},
    )
    # Vendeu 40% da posição -> custo remanescente é 60% de 1000, não
    # 1000 - 500 (que misturaria preço de venda com preço de custo).
    assert out[1]["total_invested"] == Decimal("600")
    assert out[1]["total_value"] == Decimal("600")  # 60 restantes * 10


def test_consolidated_series_sums_two_portfolios_day_by_day():
    # Duas carteiras, cada uma com seu próprio ticker — o valor combinado é
    # a soma simples dia a dia, é o que get_consolidated_performance faz.
    grid = [date(2026, 1, 1), date(2026, 1, 2)]
    txns_a = [(date(2026, 1, 1), "PETR4", _FakeTxn("buy", 10, 300))]
    txns_b = [(date(2026, 1, 1), "VALE3", _FakeTxn("buy", 5, 200))]
    close_at = lambda ticker, day: {"PETR4": Decimal("30"), "VALE3": Decimal("40")}[ticker]  # noqa: E731
    rate_at = lambda currency, day: Decimal("1")  # noqa: E731
    ticker_currency = {"PETR4": "BRL", "VALE3": "BRL"}

    series_a = _reconstruct_value_series(txns_a, grid, close_at, rate_at, ticker_currency)
    series_b = _reconstruct_value_series(txns_b, grid, close_at, rate_at, ticker_currency)
    combined = [
        {"date": d, "total_value": a["total_value"] + b["total_value"], "total_invested": a["total_invested"] + b["total_invested"]}
        for d, a, b in zip(grid, series_a, series_b)
    ]
    # 10*30 + 5*40 = 500 nos dois dias (sem transação no dia 2)
    assert combined[0]["total_value"] == Decimal("500")
    assert combined[1]["total_value"] == Decimal("500")
    assert combined[0]["total_invested"] == Decimal("500")
