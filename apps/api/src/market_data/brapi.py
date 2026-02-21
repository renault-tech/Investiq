"""Brapi.dev provider for Brazilian stocks and FIIs."""
import asyncio
from decimal import Decimal, InvalidOperation
from typing import Optional
import logging

import httpx

from src.market_data.base import MarketDataProvider, Quote, HistoricalBar

logger = logging.getLogger(__name__)

BRAPI_BASE = "https://brapi.dev/api"


def _to_decimal(value) -> Optional[Decimal]:
    if value is None:
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None


class BrapiProvider(MarketDataProvider):
    """Brapi.dev provider — free tier supports 15 req/min."""

    def __init__(self, api_key: Optional[str] = None):
        self._api_key = api_key
        self._client = httpx.AsyncClient(timeout=10.0)

    @property
    def name(self) -> str:
        return "brapi"

    def _params(self, extra: dict | None = None) -> dict:
        params = {}
        if self._api_key:
            params["token"] = self._api_key
        if extra:
            params.update(extra)
        return params

    async def get_quote(self, ticker: str) -> Optional[Quote]:
        quotes = await self.get_quotes([ticker])
        return quotes.get(ticker)

    async def get_quotes(self, tickers: list[str]) -> dict[str, Quote]:
        if not tickers:
            return {}
        tickers_str = ",".join(tickers)
        try:
            resp = await self._client.get(
                f"{BRAPI_BASE}/quote/{tickers_str}",
                params=self._params(),
            )
            resp.raise_for_status()
            data = resp.json()
            results = data.get("results", [])
            result = {}
            for item in results:
                symbol = item.get("symbol")
                price = _to_decimal(item.get("regularMarketPrice"))
                if not symbol or price is None:
                    continue
                change_pct = _to_decimal(item.get("regularMarketChangePercent"))
                result[symbol] = Quote(
                    ticker=symbol,
                    price=price,
                    currency="BRL",
                    change_pct=change_pct,
                    volume=item.get("regularMarketVolume"),
                    market_cap=_to_decimal(item.get("marketCap")),
                )
            return result
        except Exception as exc:
            logger.error("Brapi quote failed for %s: %s", tickers, exc)
            return {}

    async def get_historical(
        self,
        ticker: str,
        period: str = "1y",
        interval: str = "1d",
    ) -> list[HistoricalBar]:
        try:
            resp = await self._client.get(
                f"{BRAPI_BASE}/quote/{ticker}",
                params=self._params({"range": period, "interval": interval, "fundamental": "false"}),
            )
            resp.raise_for_status()
            data = resp.json()
            results = data.get("results", [])
            if not results:
                return []
            history = results[0].get("historicalDataPrice", [])
            bars = []
            from datetime import datetime
            for bar in history:
                date_ts = bar.get("date")
                if date_ts is None:
                    continue
                date = datetime.utcfromtimestamp(date_ts)
                bars.append(HistoricalBar(
                    ticker=ticker,
                    date=date,
                    open=_to_decimal(bar.get("open")) or Decimal("0"),
                    high=_to_decimal(bar.get("high")) or Decimal("0"),
                    low=_to_decimal(bar.get("low")) or Decimal("0"),
                    close=_to_decimal(bar.get("close")) or Decimal("0"),
                    volume=int(bar.get("volume") or 0),
                    adjusted_close=_to_decimal(bar.get("adjustedClose")),
                ))
            return bars
        except Exception as exc:
            logger.error("Brapi history failed for %s: %s", ticker, exc)
            return []
