"""Unit tests for finance service — RRULE expansion, month bounds, tag parsing."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from datetime import datetime, timezone
from unittest.mock import MagicMock

from src.finance.service import expand_recurring, _month_bounds, _parse_tags


def make_recurring_txn(rule: str, base: datetime):
    txn = MagicMock()
    txn.id = "11111111-1111-1111-1111-111111111111"
    txn.recurrence_rule = rule
    txn.transaction_date = base
    return txn


def test_monthly_rrule_expands_future_occurrences():
    base = datetime(2026, 1, 15, 12, 0, tzinfo=timezone.utc)
    txn = make_recurring_txn("FREQ=MONTHLY", base)
    window_end = datetime(2026, 4, 30, tzinfo=timezone.utc)
    occurrences = expand_recurring(txn, base, window_end)
    # template (jan) is a real row — expansion yields feb, mar, apr
    assert [o.month for o in occurrences] == [2, 3, 4]
    assert all(o.day == 15 for o in occurrences)


def test_weekly_rrule_respects_window_start():
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    txn = make_recurring_txn("FREQ=WEEKLY", base)
    start = datetime(2026, 2, 1, tzinfo=timezone.utc)
    end = datetime(2026, 2, 28, tzinfo=timezone.utc)
    occurrences = expand_recurring(txn, start, end)
    assert occurrences
    assert all(start <= o <= end for o in occurrences)


def test_invalid_rrule_returns_empty():
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    txn = make_recurring_txn("FREQ=BANANA", base)
    assert expand_recurring(txn, base, datetime(2026, 12, 31, tzinfo=timezone.utc)) == []


def test_naive_template_date_does_not_crash():
    base = datetime(2026, 1, 10)  # sem tzinfo — normalizado para UTC
    txn = make_recurring_txn("FREQ=MONTHLY;COUNT=3", base)
    end = datetime(2026, 6, 30, tzinfo=timezone.utc)
    occurrences = expand_recurring(txn, datetime(2026, 1, 1, tzinfo=timezone.utc), end)
    assert len(occurrences) == 2  # COUNT=3 inclui o template


def test_month_bounds_december_rolls_year():
    start, end = _month_bounds("2026-12")
    assert start == datetime(2026, 12, 1, tzinfo=timezone.utc)
    assert end.month == 12 and end.day == 31


def test_parse_tags_tolerates_garbage():
    assert _parse_tags(None) == []
    assert _parse_tags("not json") == []
    assert _parse_tags('{"a":1}') == []
    assert _parse_tags('["casa","fixo"]') == ["casa", "fixo"]
