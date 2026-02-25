"""Background job: evaluate active price alerts against current asset prices.

Runs every minute. Uses a Redis lock (TTL=55s) to prevent duplicate
executions across multiple instances.
"""
import json
import logging
from datetime import datetime
from zoneinfo import ZoneInfo

import redis.asyncio as aioredis
from sqlalchemy import select, update

from src.config import settings
from src.database import AsyncSessionLocal
from src.portfolio.models import PriceAlert, Asset

logger = logging.getLogger(__name__)

_LOCK_KEY = "lock:alert_checker"
_LOCK_TTL = 55  # seconds — shorter than 1-min interval


async def alert_checker_job() -> None:
    """Check all active price alerts and trigger those whose condition is met."""
    redis_client = None
    try:
        redis_client = aioredis.from_url(settings.REDIS_URL)

        acquired = await redis_client.set(_LOCK_KEY, "1", nx=True, px=_LOCK_TTL * 1000)
        if not acquired:
            logger.debug("Alert checker skipped — lock held by another instance")
            return

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(PriceAlert, Asset)
                .join(Asset, Asset.id == PriceAlert.asset_id)
                .where(PriceAlert.is_active.is_(True))
                .where(PriceAlert.triggered_at.is_(None))
                .where(Asset.last_price.is_not(None))
            )
            rows = result.all()

        if not rows:
            return

        triggered_ids: list = []
        triggered_payloads: list[str] = []
        now = datetime.now(ZoneInfo("UTC"))

        for alert, asset in rows:
            price = asset.last_price
            threshold = alert.threshold
            triggered = False

            if alert.alert_type == "price_above" and price >= threshold:
                triggered = True
            elif alert.alert_type == "price_below" and price <= threshold:
                triggered = True
            # pct_change alerts require a reference price stored elsewhere — skipped here

            if triggered:
                triggered_ids.append(alert.id)
                triggered_payloads.append(json.dumps({
                    "type": "alert_triggered",
                    "user_id": str(alert.user_id),
                    "asset": asset.ticker,
                    "alert_type": alert.alert_type,
                    "threshold": str(threshold),
                    "price": str(price),
                }))

        # Persist state BEFORE publishing — prevents duplicate notifications on partial failure
        if triggered_ids:
            async with AsyncSessionLocal() as db:
                await db.execute(
                    update(PriceAlert)
                    .where(PriceAlert.id.in_(triggered_ids))
                    .values(is_active=False, triggered_at=now)
                )
                await db.commit()

            for payload in triggered_payloads:
                await redis_client.publish("alert_triggered", payload)
            logger.info("Alert checker: %d alert(s) triggered", len(triggered_ids))

    except Exception as exc:
        logger.error("Alert checker job error: %s", exc, exc_info=True)
    finally:
        if redis_client:
            await redis_client.aclose()
