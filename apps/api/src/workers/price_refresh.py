"""Background job: refresh asset prices from market data providers.

Runs every 5 minutes but skips execution outside market hours.
Uses a Redis distributed lock (TTL=270s) to prevent duplicate runs
when multiple app instances are deployed.
"""
import json
import logging
from datetime import datetime
from zoneinfo import ZoneInfo

import redis.asyncio as aioredis
from sqlalchemy import select, update, exists

from src.config import settings
from src.database import AsyncSessionLocal
from src.portfolio.models import Asset, PortfolioPosition
from src.market_data.factory import get_provider, get_cache

logger = logging.getLogger(__name__)

_LOCK_KEY = "lock:price_refresh"
_LOCK_TTL = 270  # seconds — shorter than 5-min interval


def _is_market_hours() -> bool:
    """Return True if B3 (São Paulo) or NYSE (New York) is currently open."""
    from datetime import time

    now_utc = datetime.now(ZoneInfo("UTC"))
    if now_utc.weekday() >= 5:  # Saturday=5, Sunday=6
        return False

    now_brt = now_utc.astimezone(ZoneInfo("America/Sao_Paulo")).time()
    if time(10, 0) <= now_brt <= time(18, 30):
        return True

    now_et = now_utc.astimezone(ZoneInfo("America/New_York")).time()
    if time(9, 30) <= now_et <= time(16, 0):
        return True

    return False


async def price_refresh_job() -> None:
    """Refresh last_price on all assets held in portfolios."""
    if not _is_market_hours():
        return

    redis_client = None
    try:
        redis_client = aioredis.from_url(settings.REDIS_URL)

        # Distributed lock — only one instance runs at a time
        acquired = await redis_client.set(_LOCK_KEY, "1", nx=True, px=_LOCK_TTL * 1000)
        if not acquired:
            logger.debug("Price refresh skipped — lock held by another instance")
            return

        # Load all assets that have at least one portfolio position
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Asset).where(
                    exists().where(PortfolioPosition.asset_id == Asset.id)
                )
            )
            assets = result.scalars().all()

        if not assets:
            return

        tickers = [a.ticker for a in assets]
        provider = get_provider()
        quotes = await provider.get_quotes(tickers)

        if not quotes:
            logger.warning("Price refresh: provider returned no quotes")
            return

        now = datetime.now(ZoneInfo("UTC"))

        # Persist prices to DB
        async with AsyncSessionLocal() as db:
            for asset in assets:
                quote = quotes.get(asset.ticker)
                if quote:
                    await db.execute(
                        update(Asset)
                        .where(Asset.id == asset.id)
                        .values(last_price=quote.price, last_price_at=now)
                    )
            await db.commit()

        # Warm Redis cache
        cache = get_cache(redis_client)
        await cache.set_quotes({t: q for t, q in quotes.items()})

        # Publish price updates for WebSocket consumers
        for quote in quotes.values():
            payload = json.dumps({
                "ticker": quote.ticker,
                "price": str(quote.price),
                "change_pct": str(quote.change_pct) if quote.change_pct is not None else None,
            })
            await redis_client.publish("price_updates", payload)

        logger.info("Price refresh: updated %d/%d quotes", len(quotes), len(tickers))

    except Exception as exc:
        logger.error("Price refresh job error: %s", exc, exc_info=True)
    finally:
        if redis_client:
            await redis_client.aclose()
