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
