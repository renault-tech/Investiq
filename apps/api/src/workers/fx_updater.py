"""Background job: update daily FX exchange rates (USD/BRL, EUR/BRL, USD/EUR).

Runs once daily at 18:00 UTC via APScheduler cron.
Uses Yahoo Finance tickers like USDBRL=X to fetch spot rates.
Upserts into fx_rates table using PostgreSQL ON CONFLICT DO UPDATE.
Uses a 1-hour Redis lock to prevent duplicate runs from multiple instances.
"""
import logging
from datetime import datetime
from zoneinfo import ZoneInfo

import redis.asyncio as aioredis
from sqlalchemy.dialects.postgresql import insert as pg_insert

from src.config import settings
from src.database import AsyncSessionLocal
from src.market_data.yahoo import YahooFinanceProvider
from src.portfolio.models import FxRate

logger = logging.getLogger(__name__)

_LOCK_KEY = "lock:fx_update"
_LOCK_TTL = 3600  # 1 hour — longer than the daily job duration

# Yahoo Finance FX ticker format: {FROM}{TO}=X
_FX_PAIRS: list[tuple[str, str]] = [
    ("USD", "BRL"),
    ("EUR", "BRL"),
    ("USD", "EUR"),
]


async def fx_update_job() -> None:
    """Fetch current FX rates and upsert today's UTC row in fx_rates."""
    redis_client = None
    try:
        redis_client = aioredis.from_url(settings.REDIS_URL)

        acquired = await redis_client.set(_LOCK_KEY, "1", nx=True, px=_LOCK_TTL * 1000)
        if not acquired:
            logger.debug("FX update skipped — lock held by another instance")
            return

        now = datetime.now(ZoneInfo("UTC"))
        today = now.date()  # UTC date — consistent with server timezone

        provider = YahooFinanceProvider()
        yf_tickers = [f"{f}{t}=X" for f, t in _FX_PAIRS]

        try:
            quotes = await provider.get_quotes(yf_tickers)
        except Exception as exc:
            logger.error("FX update: failed to fetch quotes from Yahoo Finance: %s", exc)
            return

        rows_updated = 0
        async with AsyncSessionLocal() as db:
            for (from_ccy, to_ccy), ticker in zip(_FX_PAIRS, yf_tickers):
                quote = quotes.get(ticker)
                if not quote or not quote.price:
                    logger.warning("FX update: no rate returned for %s", ticker)
                    continue

                stmt = (
                    pg_insert(FxRate)
                    .values(
                        from_currency=from_ccy,
                        to_currency=to_ccy,
                        rate=quote.price,
                        date=today,
                        created_at=now,
                        updated_at=now,
                    )
                    .on_conflict_do_update(
                        constraint="uq_fx_rates_pair_date",
                        set_={"rate": quote.price, "updated_at": now},
                    )
                )
                await db.execute(stmt)
                rows_updated += 1

            await db.commit()

        logger.info("FX update complete: %d/%d pairs updated", rows_updated, len(_FX_PAIRS))

    except Exception as exc:
        logger.error("FX update job error: %s", exc, exc_info=True)
    finally:
        if redis_client:
            await redis_client.aclose()
