"""Background job: persist a daily value snapshot per portfolio.

Runs once a day after B3 close. Uses a Redis distributed lock to avoid
duplicate runs across app instances. Values are computed with the same
logic as the portfolio summary (live/cached prices, Decimal only).
"""
import logging
from datetime import datetime, timezone

import redis.asyncio as aioredis
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from src.config import settings
from src.database import AsyncSessionLocal
from src.auth.models import UserSettings
from src.portfolio.models import Portfolio, PortfolioSnapshot
from src.portfolio import service as portfolio_service
from src.settings.service import get_decrypted_api_keys
from src.workers.locking import acquire_lock_or_proceed

logger = logging.getLogger(__name__)

_LOCK_KEY = "lock:portfolio_snapshot"
_LOCK_TTL = 3600  # seconds


async def snapshot_job() -> None:
    """Compute and upsert today's snapshot for every portfolio."""
    redis_client = None
    try:
        try:
            redis_client = aioredis.from_url(settings.REDIS_URL)
        except Exception as exc:
            logger.warning("Redis unavailable for snapshot lock: %s", exc)
            redis_client = None

        if not await acquire_lock_or_proceed(redis_client, _LOCK_KEY, _LOCK_TTL):
            logger.debug("Snapshot job skipped — lock held by another instance")
            return

        today = datetime.now(timezone.utc).date()

        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Portfolio))
            portfolios = list(result.scalars().all())

            settings_result = await db.execute(select(UserSettings))
            settings_by_user = {s.user_id: s for s in settings_result.scalars().all()}

            saved = 0
            for portfolio in portfolios:
                user_settings = settings_by_user.get(portfolio.user_id)
                preferred = user_settings.preferred_provider if user_settings else "yahoo"
                brapi_key = get_decrypted_api_keys(user_settings)["brapi_key"] if user_settings else None

                try:
                    summary = await portfolio_service.get_portfolio_summary(
                        portfolio_id=portfolio.id,
                        user_id=portfolio.user_id,
                        db=db,
                        redis=redis_client,
                        preferred_provider=preferred,
                        brapi_key=brapi_key,
                    )
                except Exception as exc:
                    logger.warning("Snapshot failed for portfolio %s: %s", portfolio.id, exc)
                    continue

                stmt = pg_insert(PortfolioSnapshot).values(
                    portfolio_id=portfolio.id,
                    user_id=portfolio.user_id,
                    snapshot_date=today,
                    total_value=summary["total_market_value_brl"],
                    total_invested=summary["total_invested_brl"],
                    total_pnl=summary["total_pnl_absolute"],
                    currency=portfolio.currency,
                ).on_conflict_do_update(
                    constraint="uq_portfolio_snapshots_portfolio_date",
                    set_={
                        "total_value": summary["total_market_value_brl"],
                        "total_invested": summary["total_invested_brl"],
                        "total_pnl": summary["total_pnl_absolute"],
                    },
                )
                await db.execute(stmt)
                saved += 1

            await db.commit()
            logger.info("Snapshot job saved %d/%d portfolios", saved, len(portfolios))
    except Exception as exc:
        logger.error("Snapshot job failed: %s", exc)
    finally:
        if redis_client:
            await redis_client.aclose()
