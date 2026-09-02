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
