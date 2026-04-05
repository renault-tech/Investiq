"""Technical indicators service using pandas.

All output values are normalized to Python Decimal for precision.
Input OHLCV data comes from market data provider historical bars.
"""
import logging
from decimal import Decimal, InvalidOperation
from typing import Optional

from src.market_data.base import HistoricalBar

logger = logging.getLogger(__name__)


def _to_decimal(value) -> Optional[Decimal]:
    """Safely convert a float/int value to Decimal."""
    if value is None:
        return None
    try:
        import math
        if isinstance(value, float) and math.isnan(value):
            return None
        return Decimal(str(round(float(value), 8)))
    except (InvalidOperation, ValueError, TypeError):
        return None


def _bars_to_df(bars: list[HistoricalBar]):
    """Convert HistoricalBar list to a pandas DataFrame."""
    import pandas as pd
    if not bars:
        return pd.DataFrame()
    records = [
        {
            "open": float(bar.open),
            "high": float(bar.high),
            "low": float(bar.low),
            "close": float(bar.close),
            "volume": float(bar.volume),
            "date": bar.date,
        }
        for bar in bars
    ]
    df = pd.DataFrame(records)
    df.set_index("date", inplace=True)
    df.sort_index(inplace=True)
    return df


# ---------------------------------------------------------------------------
# RSI — Relative Strength Index
# ---------------------------------------------------------------------------


def calculate_rsi(bars: list[HistoricalBar], period: int = 14) -> list[dict]:
    """Calculate RSI for a list of OHLCV bars using pure pandas."""
    df = _bars_to_df(bars)
    if df.empty or len(df) < period + 1:
        return []

    delta = df['close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()

    # Calculate RS
    rs = gain / loss
    
    # Calculate RSI
    rsi_series = 100 - (100 / (1 + rs))

    result = []
    for date, value in rsi_series.items():
        result.append({
            "date": date.to_pydatetime() if hasattr(date, "to_pydatetime") else date,
            "rsi": _to_decimal(value),
        })
    return result


# ---------------------------------------------------------------------------
# MACD — Moving Average Convergence/Divergence
# ---------------------------------------------------------------------------


def calculate_macd(
    bars: list[HistoricalBar],
    fast: int = 12,
    slow: int = 26,
    signal: int = 9,
) -> list[dict]:
    """Calculate MACD using pure pandas."""
    df = _bars_to_df(bars)
    if df.empty or len(df) < slow + signal:
        return []

    ema_fast = df['close'].ewm(span=fast, adjust=False).mean()
    ema_slow = df['close'].ewm(span=slow, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    histogram = macd_line - signal_line

    result = []
    for date in df.index:
        result.append({
            "date": date.to_pydatetime() if hasattr(date, "to_pydatetime") else date,
            "macd": _to_decimal(macd_line[date]),
            "signal": _to_decimal(signal_line[date]),
            "histogram": _to_decimal(histogram[date]),
        })
    return result


# ---------------------------------------------------------------------------
# Bollinger Bands
# ---------------------------------------------------------------------------


def calculate_bollinger_bands(
    bars: list[HistoricalBar],
    period: int = 20,
    std_dev: float = 2.0,
) -> list[dict]:
    """Calculate Bollinger Bands using pure pandas."""
    df = _bars_to_df(bars)
    if df.empty or len(df) < period:
        return []

    middle = df['close'].rolling(window=period).mean()
    std = df['close'].rolling(window=period).std()
    upper = middle + (std * std_dev)
    lower = middle - (std * std_dev)
    
    # Avoid division by zero
    bandwidth = (upper - lower) / (middle.replace(0, 1)) * 100
    
    b_range = (upper - lower).replace(0, 1)
    pct_b = (df['close'] - lower) / b_range

    result = []
    for date in df.index:
        result.append({
            "date": date.to_pydatetime() if hasattr(date, "to_pydatetime") else date,
            "upper": _to_decimal(upper[date]),
            "middle": _to_decimal(middle[date]),
            "lower": _to_decimal(lower[date]),
            "bandwidth": _to_decimal(bandwidth[date]),
            "pct_b": _to_decimal(pct_b[date]),
        })
    return result


# ---------------------------------------------------------------------------
# SMA / EMA
# ---------------------------------------------------------------------------


def calculate_sma(bars: list[HistoricalBar], period: int = 20) -> list[dict]:
    df = _bars_to_df(bars)
    if df.empty or len(df) < period:
        return []
    sma = df['close'].rolling(window=period).mean()
    return [
        {
            "date": d.to_pydatetime() if hasattr(d, "to_pydatetime") else d,
            "sma": _to_decimal(v),
        }
        for d, v in sma.items()
    ]


def calculate_ema(bars: list[HistoricalBar], period: int = 20) -> list[dict]:
    df = _bars_to_df(bars)
    if df.empty or len(df) < period:
        return []
    ema = df['close'].ewm(span=period, adjust=False).mean()
    return [
        {
            "date": d.to_pydatetime() if hasattr(d, "to_pydatetime") else d,
            "ema": _to_decimal(v),
        }
        for d, v in ema.items()
    ]


# ---------------------------------------------------------------------------
# Combined indicator bundle for charting
# ---------------------------------------------------------------------------


def get_indicator_bundle(
    bars: list[HistoricalBar],
    include_rsi: bool = True,
    include_macd: bool = True,
    include_bollinger: bool = True,
    rsi_period: int = 14,
    macd_fast: int = 12,
    macd_slow: int = 26,
    macd_signal: int = 9,
    bb_period: int = 20,
    bb_std: float = 2.0,
) -> dict:
    """Calculate multiple indicators in one call."""
    result = {}

    if include_rsi:
        try:
            result["rsi"] = calculate_rsi(bars, period=rsi_period)
        except Exception as exc:
            logger.warning("RSI calculation failed: %s", exc)
            result["rsi"] = []

    if include_macd:
        try:
            result["macd"] = calculate_macd(bars, fast=macd_fast, slow=macd_slow, signal=macd_signal)
        except Exception as exc:
            logger.warning("MACD calculation failed: %s", exc)
            result["macd"] = []

    if include_bollinger:
        try:
            result["bollinger"] = calculate_bollinger_bands(bars, period=bb_period, std_dev=bb_std)
        except Exception as exc:
            logger.warning("Bollinger Bands calculation failed: %s", exc)
            result["bollinger"] = []

    return result
