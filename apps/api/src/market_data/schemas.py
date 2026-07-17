"""Pydantic response schemas for market data endpoints."""
from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel


class BarResponse(BaseModel):
    date: datetime
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    volume: int


class HistoryResponse(BaseModel):
    ticker: str
    period: str
    interval: str
    bars: list[BarResponse]


class RsiPoint(BaseModel):
    date: datetime
    rsi: Optional[Decimal]


class MacdPoint(BaseModel):
    date: datetime
    macd: Optional[Decimal]
    signal: Optional[Decimal]
    histogram: Optional[Decimal]


class BollingerPoint(BaseModel):
    date: datetime
    upper: Optional[Decimal]
    middle: Optional[Decimal]
    lower: Optional[Decimal]


class MaPoint(BaseModel):
    date: datetime
    value: Optional[Decimal]


class MaSeries(BaseModel):
    period: int
    points: list[MaPoint]


class IndicatorsResponse(BaseModel):
    ticker: str
    rsi: list[RsiPoint]
    macd: list[MacdPoint]
    bollinger: list[BollingerPoint]
    sma: list[MaSeries]
    ema: list[MaSeries]


class FundamentalsResponse(BaseModel):
    ticker: str
    name: Optional[str]
    sector: Optional[str]
    market_cap: Optional[Decimal]
    p_l: Optional[Decimal]
    p_vp: Optional[Decimal]
    dividend_yield: Optional[Decimal]
    roe: Optional[Decimal]
    net_margin: Optional[Decimal]
    lpa: Optional[Decimal]
    vpa: Optional[Decimal]
    revenue_ttm: Optional[Decimal]
    net_income_ttm: Optional[Decimal]
    week52_high: Optional[Decimal]
    week52_low: Optional[Decimal]
