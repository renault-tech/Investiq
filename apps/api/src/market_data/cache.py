"""Redis cache layer for market data quotes and historical bars."""
import json
import logging
from decimal import Decimal
from typing import Optional
from datetime import datetime

import redis.asyncio as aioredis

from dataclasses import asdict

from src.market_data.base import Quote, HistoricalBar, Fundamentals, FundComposition, FundHolding

logger = logging.getLogger(__name__)

# Quote TTL in seconds (5 minutes for live prices)
QUOTE_TTL = 300
# Historical data TTL (4 hours — less volatile)
HISTORY_TTL = 14400
# Fundamentals TTL (24 hours — updates at most daily)
FUNDAMENTALS_TTL = 86400
# Fund composition TTL (7 days — index/ETF weightings rebalance quarterly at most)
FUND_COMPOSITION_TTL = 604800

# String-valued Fundamentals fields — everything else in the dataclass is a
# Decimal and needs Decimal(...) reconstruction on read.
_FUNDAMENTALS_STR_FIELDS = ("ticker", "name", "sector", "country", "quote_type")


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


def _bar_to_dict(bar: HistoricalBar) -> dict:
    return {
        "ticker": bar.ticker,
        "date": bar.date.isoformat(),
        "open": str(bar.open),
        "high": str(bar.high),
        "low": str(bar.low),
        "close": str(bar.close),
        "volume": bar.volume,
        "adjusted_close": str(bar.adjusted_close) if bar.adjusted_close is not None else None,
    }


def _dict_to_bar(data: dict) -> HistoricalBar:
    return HistoricalBar(
        ticker=data["ticker"],
        date=datetime.fromisoformat(data["date"]),
        open=Decimal(data["open"]),
        high=Decimal(data["high"]),
        low=Decimal(data["low"]),
        close=Decimal(data["close"]),
        volume=int(data["volume"]),
        adjusted_close=Decimal(data["adjusted_close"]) if data.get("adjusted_close") else None,
    )


class MarketDataCache:
    """Redis-backed cache for market data quotes and historical bars."""

    def __init__(self, redis: aioredis.Redis):
        self._redis = redis

    def _quote_key(self, ticker: str) -> str:
        return f"quote:{ticker.upper()}"

    def _history_key(self, ticker: str, period: str, interval: str) -> str:
        return f"history:{ticker.upper()}:{period}:{interval}"

    # ------------------------------------------------------------------
    # Quote cache
    # ------------------------------------------------------------------

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
        """Bulk fetch quotes using MGET (single Redis round-trip)."""
        if not tickers:
            return {}
        keys = [self._quote_key(t) for t in tickers]
        try:
            raws = await self._redis.mget(*keys)
        except Exception as exc:
            logger.warning("Cache get_quotes failed: %s", exc)
            return {}
        result = {}
        for ticker, raw in zip(tickers, raws):
            if raw is not None:
                try:
                    result[ticker] = _dict_to_quote(json.loads(raw))
                except Exception:
                    pass
        return result

    async def set_quotes(self, quotes: dict[str, Quote], ttl: int = QUOTE_TTL) -> None:
        """Bulk set quotes using a Redis pipeline."""
        if not quotes:
            return
        try:
            pipe = self._redis.pipeline()
            for quote in quotes.values():
                pipe.setex(
                    self._quote_key(quote.ticker),
                    ttl,
                    json.dumps(_quote_to_dict(quote)),
                )
            await pipe.execute()
        except Exception as exc:
            logger.warning("Cache set_quotes pipeline failed: %s", exc)

    async def invalidate(self, ticker: str) -> None:
        try:
            await self._redis.delete(self._quote_key(ticker))
        except Exception as exc:
            logger.warning("Cache invalidate failed for %s: %s", ticker, exc)

    # ------------------------------------------------------------------
    # Historical bar cache
    # ------------------------------------------------------------------

    async def get_historical(
        self,
        ticker: str,
        period: str = "1y",
        interval: str = "1d",
    ) -> Optional[list[HistoricalBar]]:
        """Return cached historical bars or None if not cached."""
        try:
            raw = await self._redis.get(self._history_key(ticker, period, interval))
            if raw is None:
                return None
            data = json.loads(raw)
            return [_dict_to_bar(item) for item in data]
        except Exception as exc:
            logger.warning("Cache get_historical failed for %s: %s", ticker, exc)
            return None

    async def set_historical(
        self,
        ticker: str,
        bars: list[HistoricalBar],
        period: str = "1y",
        interval: str = "1d",
        ttl: int = HISTORY_TTL,
    ) -> None:
        """Cache a list of historical bars."""
        if not bars:
            return
        try:
            payload = json.dumps([_bar_to_dict(b) for b in bars])
            await self._redis.setex(
                self._history_key(ticker, period, interval),
                ttl,
                payload,
            )
        except Exception as exc:
            logger.warning("Cache set_historical failed for %s: %s", ticker, exc)

    # ------------------------------------------------------------------
    # Fundamentals cache
    # ------------------------------------------------------------------

    def _fundamentals_key(self, ticker: str) -> str:
        return f"fundamentals:{ticker.upper()}"

    async def get_fundamentals(self, ticker: str) -> Optional[Fundamentals]:
        try:
            raw = await self._redis.get(self._fundamentals_key(ticker))
            if raw is None:
                return None
            data = json.loads(raw)
            return Fundamentals(**{
                key: (Decimal(value) if key not in _FUNDAMENTALS_STR_FIELDS and value is not None else value)
                for key, value in data.items()
            })
        except Exception as exc:
            logger.warning("Cache get_fundamentals failed for %s: %s", ticker, exc)
            return None

    async def set_fundamentals(self, fundamentals: Fundamentals, ttl: int = FUNDAMENTALS_TTL) -> None:
        try:
            data = {
                key: (str(value) if isinstance(value, Decimal) else value)
                for key, value in asdict(fundamentals).items()
            }
            await self._redis.setex(self._fundamentals_key(fundamentals.ticker), ttl, json.dumps(data))
        except Exception as exc:
            logger.warning("Cache set_fundamentals failed for %s: %s", fundamentals.ticker, exc)

    # ------------------------------------------------------------------
    # Fund composition cache (ETF/fund sector, asset-class, top-holdings)
    # ------------------------------------------------------------------

    def _fund_composition_key(self, ticker: str) -> str:
        return f"fund_composition:{ticker.upper()}"

    async def get_fund_composition(self, ticker: str) -> Optional[FundComposition]:
        try:
            raw = await self._redis.get(self._fund_composition_key(ticker))
            if raw is None:
                return None
            data = json.loads(raw)
            return FundComposition(
                ticker=data["ticker"],
                sector_weights={k: Decimal(v) for k, v in data["sector_weights"].items()},
                asset_class_weights={k: Decimal(v) for k, v in data["asset_class_weights"].items()},
                top_holdings=[
                    FundHolding(symbol=h["symbol"], name=h["name"], weight=Decimal(h["weight"]))
                    for h in data["top_holdings"]
                ],
                fetched_at=datetime.fromisoformat(data["fetched_at"]),
            )
        except Exception as exc:
            logger.warning("Cache get_fund_composition failed for %s: %s", ticker, exc)
            return None

    async def set_fund_composition(self, composition: FundComposition, ttl: int = FUND_COMPOSITION_TTL) -> None:
        try:
            data = {
                "ticker": composition.ticker,
                "sector_weights": {k: str(v) for k, v in composition.sector_weights.items()},
                "asset_class_weights": {k: str(v) for k, v in composition.asset_class_weights.items()},
                "top_holdings": [
                    {"symbol": h.symbol, "name": h.name, "weight": str(h.weight)}
                    for h in composition.top_holdings
                ],
                "fetched_at": composition.fetched_at.isoformat(),
            }
            await self._redis.setex(self._fund_composition_key(composition.ticker), ttl, json.dumps(data))
        except Exception as exc:
            logger.warning("Cache set_fund_composition failed for %s: %s", composition.ticker, exc)
