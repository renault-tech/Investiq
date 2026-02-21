"""Redis cache layer for market data quotes."""
import json
import logging
from decimal import Decimal
from typing import Optional
from datetime import datetime

import redis.asyncio as aioredis

from src.market_data.base import Quote

logger = logging.getLogger(__name__)

# Quote TTL in seconds (5 minutes for live prices)
QUOTE_TTL = 300
# Historical data TTL (4 hours — less volatile)
HISTORY_TTL = 14400


def _quote_to_dict(quote: Quote) -> dict:
    return {
        "ticker": quote.ticker,
        "price": str(quote.price),
        "currency": quote.currency,
        "change_pct": str(quote.change_pct) if quote.change_pct is not None else None,
        "volume": quote.volume,
        "market_cap": str(quote.market_cap) if quote.market_cap is not None else None,
        "fetched_at": quote.fetched_at.isoformat(),
    }


def _dict_to_quote(data: dict) -> Quote:
    return Quote(
        ticker=data["ticker"],
        price=Decimal(data["price"]),
        currency=data["currency"],
        change_pct=Decimal(data["change_pct"]) if data.get("change_pct") else None,
        volume=data.get("volume"),
        market_cap=Decimal(data["market_cap"]) if data.get("market_cap") else None,
        fetched_at=datetime.fromisoformat(data["fetched_at"]),
    )


class MarketDataCache:
    """Redis-backed cache for market data."""

    def __init__(self, redis: aioredis.Redis):
        self._redis = redis

    def _quote_key(self, ticker: str) -> str:
        return f"quote:{ticker.upper()}"

    async def get_quote(self, ticker: str) -> Optional[Quote]:
        try:
            raw = await self._redis.get(self._quote_key(ticker))
            if raw is None:
                return None
            return _dict_to_quote(json.loads(raw))
        except Exception as exc:
            logger.warning("Cache get_quote failed for %s: %s", ticker, exc)
            return None

    async def set_quote(self, quote: Quote, ttl: int = QUOTE_TTL) -> None:
        try:
            await self._redis.setex(
                self._quote_key(quote.ticker),
                ttl,
                json.dumps(_quote_to_dict(quote)),
            )
        except Exception as exc:
            logger.warning("Cache set_quote failed for %s: %s", quote.ticker, exc)

    async def get_quotes(self, tickers: list[str]) -> dict[str, Quote]:
        result = {}
        for ticker in tickers:
            q = await self.get_quote(ticker)
            if q is not None:
                result[ticker] = q
        return result

    async def set_quotes(self, quotes: dict[str, Quote], ttl: int = QUOTE_TTL) -> None:
        for quote in quotes.values():
            await self.set_quote(quote, ttl)

    async def invalidate(self, ticker: str) -> None:
        try:
            await self._redis.delete(self._quote_key(ticker))
        except Exception as exc:
            logger.warning("Cache invalidate failed for %s: %s", ticker, exc)
