"""Yahoo Finance provider via yfinance library."""
import asyncio
from decimal import Decimal, InvalidOperation
from typing import Optional
import logging

from src.market_data.base import MarketDataProvider, Quote, HistoricalBar

logger = logging.getLogger(__name__)


def _to_decimal(value) -> Optional[Decimal]:
    """Safely convert a value to Decimal, returning None on failure."""
    if value is None:
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None


class YahooFinanceProvider(MarketDataProvider):
    """Free Yahoo Finance provider using yfinance."""

    @property
    def name(self) -> str:
        return "yahoo"

    async def get_quote(self, ticker: str) -> Optional[Quote]:
        """Fetch single quote. Runs yfinance in executor to avoid blocking."""
        quotes = await self.get_quotes([ticker])
        return quotes.get(ticker)

    async def get_quotes(self, tickers: list[str]) -> dict[str, Quote]:
        """Bulk fetch quotes from Yahoo Finance."""
        if not tickers:
            return {}
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._fetch_quotes_sync, tickers)

    def _fetch_quotes_sync(self, tickers: list[str]) -> dict[str, Quote]:
        """Synchronous yfinance call — runs in thread executor."""
        try:
            import yfinance as yf
            data = yf.Tickers(" ".join(tickers))
            result = {}
            for ticker in tickers:
                try:
                    info = data.tickers[ticker].fast_info
                    price = _to_decimal(getattr(info, "last_price", None))
                    if price is None:
                        continue
                    currency = getattr(info, "currency", "USD") or "USD"
                    result[ticker] = Quote(
                        ticker=ticker,
                        price=price,
                        currency=currency,
                        change_pct=None,  # fast_info doesn't include change%
                        volume=getattr(info, "three_month_average_volume", None),
                        market_cap=_to_decimal(getattr(info, "market_cap", None)),
                    )
                except Exception as exc:
                    logger.warning("Yahoo quote failed for %s: %s", ticker, exc)
            return result
        except Exception as exc:
            logger.error("Yahoo Finance bulk fetch failed: %s", exc)
            return {}

    async def get_historical(
        self,
        ticker: str,
        period: str = "1y",
        interval: str = "1d",
    ) -> list[HistoricalBar]:
        """Fetch OHLCV history from Yahoo Finance."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, self._fetch_history_sync, ticker, period, interval
        )

    def _fetch_history_sync(self, ticker: str, period: str, interval: str) -> list[HistoricalBar]:
        try:
            import yfinance as yf
            import pandas as pd
            df = yf.download(ticker, period=period, interval=interval, progress=False, auto_adjust=True)
            if df.empty:
                return []
            bars = []
            for ts, row in df.iterrows():
                date = ts.to_pydatetime() if hasattr(ts, "to_pydatetime") else ts
                bars.append(HistoricalBar(
                    ticker=ticker,
                    date=date,
                    open=_to_decimal(row.get("Open")) or Decimal("0"),
                    high=_to_decimal(row.get("High")) or Decimal("0"),
                    low=_to_decimal(row.get("Low")) or Decimal("0"),
                    close=_to_decimal(row.get("Close")) or Decimal("0"),
                    volume=int(row.get("Volume") or 0),
                    adjusted_close=_to_decimal(row.get("Close")),
                ))
            return bars
        except Exception as exc:
            logger.error("Yahoo history failed for %s: %s", ticker, exc)
            return []
