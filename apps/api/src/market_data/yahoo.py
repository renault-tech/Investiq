"""Yahoo Finance provider via yfinance library."""
import asyncio
from decimal import Decimal, InvalidOperation
from typing import Optional
import logging

from src.market_data.base import MarketDataProvider, Quote, HistoricalBar, Fundamentals, is_b3_ticker

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
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._fetch_quotes_sync, tickers)

    def _fetch_quotes_sync(self, tickers: list[str]) -> dict[str, Quote]:
        """Synchronous yfinance call — runs in thread executor."""
        try:
            import yfinance as yf
            
            yf_to_raw = {}
            query_tickers = []
            for t in tickers:
                # Add .SA for Brazilian tickers if no suffix exists
                if is_b3_ticker(t):
                    yf_t = f"{t}.SA"
                else:
                    yf_t = t
                query_tickers.append(yf_t)
                yf_to_raw[yf_t] = t

            data = yf.Tickers(" ".join(query_tickers))
            result = {}
            for yf_t in query_tickers:
                raw_t = yf_to_raw[yf_t]
                try:
                    info = data.tickers[yf_t].fast_info
                    price = _to_decimal(getattr(info, "last_price", None))
                    if price is None:
                        continue
                    currency = getattr(info, "currency", "USD") or "USD"
                    result[raw_t] = Quote(
                        ticker=raw_t,
                        price=price,
                        currency=currency,
                        change_pct=None,
                        volume=getattr(info, "three_month_average_volume", None),
                        market_cap=_to_decimal(getattr(info, "market_cap", None)),
                    )
                except Exception as exc:
                    logger.warning("Yahoo quote failed for %s: %s", raw_t, exc)
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
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(
            None, self._fetch_history_sync, ticker, period, interval
        )

    async def get_fundamentals(self, ticker: str) -> Optional[Fundamentals]:
        """Fetch fundamentals via yfinance get_info (free, best-effort per field)."""
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._fetch_fundamentals_sync, ticker)

    def _fetch_fundamentals_sync(self, ticker: str) -> Optional[Fundamentals]:
        try:
            import yfinance as yf
            yf_t = f"{ticker}.SA" if is_b3_ticker(ticker) else ticker
            info = yf.Ticker(yf_t).get_info()
            if not info or info.get("regularMarketPrice") is None and info.get("currentPrice") is None:
                return None
            return Fundamentals(
                ticker=ticker,
                name=info.get("longName") or info.get("shortName"),
                sector=info.get("sector"),
                market_cap=_to_decimal(info.get("marketCap")),
                p_l=_to_decimal(info.get("trailingPE")),
                p_vp=_to_decimal(info.get("priceToBook")),
                dividend_yield=_to_decimal(info.get("dividendYield")),
                roe=_to_decimal(info.get("returnOnEquity")),
                net_margin=_to_decimal(info.get("profitMargins")),
                lpa=_to_decimal(info.get("trailingEps")),
                vpa=_to_decimal(info.get("bookValue")),
                revenue_ttm=_to_decimal(info.get("totalRevenue")),
                net_income_ttm=_to_decimal(info.get("netIncomeToCommon")),
                week52_high=_to_decimal(info.get("fiftyTwoWeekHigh")),
                week52_low=_to_decimal(info.get("fiftyTwoWeekLow")),
            )
        except Exception as exc:
            logger.warning("Yahoo fundamentals failed for %s: %s", ticker, exc)
            return None

    def _fetch_history_sync(self, ticker: str, period: str, interval: str) -> list[HistoricalBar]:
        try:
            import yfinance as yf
            import pandas as pd
            yf_t = f"{ticker}.SA" if is_b3_ticker(ticker) else ticker
            df = yf.download(yf_t, period=period, interval=interval, progress=False, auto_adjust=True)
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
