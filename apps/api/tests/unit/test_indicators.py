"""Unit tests for technical indicators over synthetic OHLCV bars."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

import math
from datetime import datetime, timedelta
from decimal import Decimal

from src.market_data.base import HistoricalBar
from src.analysis.indicators import (
    calculate_rsi,
    calculate_macd,
    calculate_bollinger_bands,
    calculate_sma,
    calculate_ema,
    get_indicator_bundle,
)


def make_bars(n: int = 120) -> list[HistoricalBar]:
    """Sine-wave price series — oscillating, so RSI covers both regimes."""
    bars = []
    start = datetime(2026, 1, 1)
    for i in range(n):
        price = Decimal(str(round(100 + 10 * math.sin(i / 7) + i * 0.1, 2)))
        bars.append(HistoricalBar(
            ticker="TEST4",
            date=start + timedelta(days=i),
            open=price,
            high=price + Decimal("1"),
            low=price - Decimal("1"),
            close=price,
            volume=1_000_000 + i,
        ))
    return bars


def test_rsi_bounded_0_100():
    values = [p["rsi"] for p in calculate_rsi(make_bars()) if p["rsi"] is not None]
    assert values, "RSI should produce values"
    assert all(Decimal("0") <= v <= Decimal("100") for v in values)


def test_macd_histogram_is_macd_minus_signal():
    points = [p for p in calculate_macd(make_bars()) if p["macd"] is not None and p["signal"] is not None]
    assert points
    last = points[-1]
    assert abs(last["histogram"] - (last["macd"] - last["signal"])) < Decimal("0.0001")


def test_bollinger_ordering():
    points = [p for p in calculate_bollinger_bands(make_bars()) if p["upper"] is not None]
    assert points
    for p in points:
        assert p["lower"] <= p["middle"] <= p["upper"]


def test_sma_ema_lengths_and_warmup():
    bars = make_bars(60)
    sma = calculate_sma(bars, 20)
    ema = calculate_ema(bars, 20)
    assert len(sma) == 60 and len(ema) == 60
    # first period-1 SMA values are warm-up NaN → None
    assert all(p["sma"] is None for p in sma[:19])
    assert sma[19]["sma"] is not None


def test_bundle_short_series_degrades_empty():
    bundle = get_indicator_bundle(make_bars(5))
    assert bundle["rsi"] == []
    assert bundle["macd"] == []
    assert bundle["bollinger"] == []
