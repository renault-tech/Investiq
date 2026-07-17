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


class FixedIncomeInstrumentInput(BaseModel):
    name: str
    instrument_type: str = "cdb"
    annual_rate: Decimal = Decimal("0")
    rate_type: str = "prefixado"  # prefixado | cdi_pct | ipca_plus | selic_plus
    cdi_pct: Optional[Decimal] = None
    ipca_spread: Optional[Decimal] = None
    is_ir_exempt: bool = False


class FixedIncomeCompareRequest(BaseModel):
    instruments: list[FixedIncomeInstrumentInput]
    principal: Decimal
    business_days: int
    calendar_days: int
    cdi_rate: Optional[Decimal] = None
    ipca_rate: Optional[Decimal] = None


class FixedIncomeComparisonResult(BaseModel):
    name: str
    instrument_type: str
    annual_rate: Decimal
    rate_type: str
    is_ir_exempt: bool
    gross_return: Decimal
    ir_amount: Decimal
    net_return: Decimal
    net_amount: Decimal
    effective_annual_rate: Decimal
    ranking: int


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
