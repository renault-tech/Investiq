"""Abstract base class for market data providers."""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from decimal import Decimal
from typing import Optional
from datetime import datetime


@dataclass
class Quote:
    """Normalized price quote."""
    ticker: str
    price: Decimal
    currency: str
    change_pct: Optional[Decimal] = None  # 24h % change
    volume: Optional[int] = None
    market_cap: Optional[Decimal] = None
    fetched_at: datetime = None

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

    @property
    @abstractmethod
    def name(self) -> str:
        """Provider identifier."""
