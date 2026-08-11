"""Abstract base class for market data providers."""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from decimal import Decimal
from typing import Optional
from datetime import datetime

# B3 tickers end in a share-class digit (3=ON, 4=PN, 11=unit/FII...) with no
# exchange suffix; anything else (AAPL, VOO, PETR4.SA) is treated as foreign.
_B3_SUFFIXES = ("3", "4", "5", "6", "11", "34", "39")


def is_b3_ticker(ticker: str) -> bool:
    return ticker.endswith(_B3_SUFFIXES) and "." not in ticker


def default_currency_for_ticker(ticker: str) -> str:
    """Best-effort currency guess for a ticker with no known Asset row yet."""
    return "BRL" if is_b3_ticker(ticker) else "USD"


@dataclass
class Quote:
    """Normalized price quote."""
    ticker: str
    price: Decimal
    currency: str
    change_pct: Optional[Decimal] = None  # 24h % change
    volume: Optional[int] = None
    market_cap: Optional[Decimal] = None
    fetched_at: Optional[datetime] = None

    def __post_init__(self):
        if self.fetched_at is None:
            self.fetched_at = datetime.utcnow()


@dataclass
class Fundamentals:
    """Normalized fundamental data. Every field optional — free-tier sources
    return different subsets and the UI must degrade per field."""
    ticker: str
    name: Optional[str] = None
    sector: Optional[str] = None
    country: Optional[str] = None
    quote_type: Optional[str] = None          # "EQUITY" | "ETF" | "MUTUALFUND" | ...
    market_cap: Optional[Decimal] = None
    p_l: Optional[Decimal] = None            # price / earnings
    p_vp: Optional[Decimal] = None           # price / book
    dividend_yield: Optional[Decimal] = None  # fraction (0.065 = 6.5%)
    roe: Optional[Decimal] = None             # fraction
    net_margin: Optional[Decimal] = None      # fraction
    lpa: Optional[Decimal] = None             # earnings per share
    vpa: Optional[Decimal] = None             # book value per share
    revenue_ttm: Optional[Decimal] = None
    net_income_ttm: Optional[Decimal] = None
    week52_high: Optional[Decimal] = None
    week52_low: Optional[Decimal] = None


@dataclass
class FundHolding:
    """Single constituent of an ETF/fund's top holdings, with its weight
    inside the fund (0.0-1.0 fraction)."""
    symbol: str
    name: Optional[str]
    weight: Decimal


@dataclass
class FundComposition:
    """ETF/fund look-through data: how the fund itself is split by sector and
    asset class, plus its largest individual holdings (used to estimate a
    geographic breakdown, since Yahoo doesn't expose region weightings
    directly). All weight dicts are fractions (0.0-1.0) and may not sum to
    exactly 1 — the caller treats the gap as "unclassified"."""
    ticker: str
    sector_weights: dict[str, Decimal]
    asset_class_weights: dict[str, Decimal]
    top_holdings: list[FundHolding]
    fetched_at: Optional[datetime] = None

    def __post_init__(self):
        if self.fetched_at is None:
            self.fetched_at = datetime.utcnow()


@dataclass
class HistoricalBar:
    """Single OHLCV bar."""
    ticker: str
    date: datetime
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    volume: int
    adjusted_close: Optional[Decimal] = None


class MarketDataProvider(ABC):
    """Abstract market data provider."""

    @abstractmethod
    async def get_quote(self, ticker: str) -> Optional[Quote]:
        """Fetch current price for a single ticker. Returns None if not found."""

    @abstractmethod
    async def get_quotes(self, tickers: list[str]) -> dict[str, Quote]:
        """Fetch current prices for multiple tickers. Returns dict ticker→Quote."""

    @abstractmethod
    async def get_historical(
        self,
        ticker: str,
        period: str = "1y",
        interval: str = "1d",
    ) -> list[HistoricalBar]:
        """Fetch OHLCV history. period: 1d/5d/1mo/3mo/6mo/1y/2y/5y/10y/ytd/max"""

    async def get_fundamentals(self, ticker: str) -> Optional[Fundamentals]:
        """Fetch fundamental data. Default: not supported by this provider."""
        return None

    async def get_fund_composition(self, ticker: str) -> Optional[FundComposition]:
        """Fetch ETF/fund sector, asset-class and top-holdings breakdown.
        Default: not supported by this provider (only Yahoo has this today)."""
        return None

    @property
    @abstractmethod
    def name(self) -> str:
        """Provider identifier."""
