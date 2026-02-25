"""Technical indicators service using pandas-ta.

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
    """Convert HistoricalBar list to a pandas DataFrame suitable for pandas-ta."""
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
    """Calculate RSI for a list of OHLCV bars.

    Args:
        bars: OHLCV data sorted chronologically.
        period: RSI period (default 14).

    Returns:
        List of dicts: [{"date": datetime, "rsi": Decimal | None}, ...]
    """
    import pandas_ta as ta
    df = _bars_to_df(bars)
    if df.empty or len(df) < period + 1:
        return []

    rsi_series = ta.rsi(df["close"], length=period)
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
    """Calculate MACD line, signal line, and histogram.

    Returns:
        List of dicts: [{"date", "macd", "signal", "histogram"}, ...]
    """
    import pandas_ta as ta
    df = _bars_to_df(bars)
    if df.empty or len(df) < slow + signal:
        return []

    macd_df = ta.macd(df["close"], fast=fast, slow=slow, signal=signal)
    if macd_df is None or macd_df.empty:
        return []

    macd_col = f"MACD_{fast}_{slow}_{signal}"
    signal_col = f"MACDs_{fast}_{slow}_{signal}"
    hist_col = f"MACDh_{fast}_{slow}_{signal}"

    result = []
    for date, row in macd_df.iterrows():
        result.append({
            "date": date.to_pydatetime() if hasattr(date, "to_pydatetime") else date,
            "macd": _to_decimal(row.get(macd_col)),
            "signal": _to_decimal(row.get(signal_col)),
            "histogram": _to_decimal(row.get(hist_col)),
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
    """Calculate Bollinger Bands (upper, middle/SMA, lower).

    Returns:
        List of dicts: [{"date", "upper", "middle", "lower", "bandwidth", "pct_b"}, ...]
    """
    import pandas_ta as ta
    df = _bars_to_df(bars)
    if df.empty or len(df) < period:
        return []

    bb_df = ta.bbands(df["close"], length=period, std=std_dev)
    if bb_df is None or bb_df.empty:
        return []

    std_str = str(std_dev).replace(".", "")[:4]
    lower_col = f"BBL_{period}_{std_dev}"
    middle_col = f"BBM_{period}_{std_dev}"
    upper_col = f"BBU_{period}_{std_dev}"
    bw_col = f"BBB_{period}_{std_dev}"
    pctb_col = f"BBP_{period}_{std_dev}"

    result = []
    for date, row in bb_df.iterrows():
        result.append({
            "date": date.to_pydatetime() if hasattr(date, "to_pydatetime") else date,
            "upper": _to_decimal(row.get(upper_col)),
            "middle": _to_decimal(row.get(middle_col)),
            "lower": _to_decimal(row.get(lower_col)),
            "bandwidth": _to_decimal(row.get(bw_col)),
            "pct_b": _to_decimal(row.get(pctb_col)),
        })
    return result


# ---------------------------------------------------------------------------
# SMA / EMA
# ---------------------------------------------------------------------------


def calculate_sma(bars: list[HistoricalBar], period: int = 20) -> list[dict]:
    """Simple Moving Average."""
    import pandas_ta as ta
    df = _bars_to_df(bars)
    if df.empty or len(df) < period:
        return []
    sma = ta.sma(df["close"], length=period)
    return [
        {
            "date": d.to_pydatetime() if hasattr(d, "to_pydatetime") else d,
            "sma": _to_decimal(v),
        }
        for d, v in sma.items()
    ]


def calculate_ema(bars: list[HistoricalBar], period: int = 20) -> list[dict]:
    """Exponential Moving Average."""
    import pandas_ta as ta
    df = _bars_to_df(bars)
    if df.empty or len(df) < period:
        return []
    ema = ta.ema(df["close"], length=period)
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
    """Calculate multiple indicators in one call. Returns a dict of indicator series.

    Only computes requested indicators. Catches individual failures to avoid
    partial failures killing the whole response.
    """
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
