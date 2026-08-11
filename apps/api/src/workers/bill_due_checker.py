"""Background job: notify the user when a lançamento's due date arrives.

A transaction can be launched before it's actually paid (due_date in the
future, is_paid=False until the "Pagar" button is clicked). This job finds
those still unpaid once their due date has arrived and fires one
notification each — bill_notified_at prevents notifying the same
transaction again on the next run while it stays unpaid.

Runs daily via APScheduler cron. Uses a Redis lock to prevent duplicate
executions across multiple instances.
"""
import logging
from datetime import datetime
from zoneinfo import ZoneInfo

import redis.asyncio as aioredis
from sqlalchemy import select, update

from src.config import settings
from src.database import AsyncSessionLocal
from src.finance.models import FinancialTransaction
from src.notifications.models import Notification
from src.workers.locking import acquire_lock_or_proceed

logger = logging.getLogger(__name__)

_LOCK_KEY = "lock:bill_due_checker"
_LOCK_TTL = 300  # 5 minutes — comfortably longer than one run, well under the 1-day interval


async def bill_due_checker_job() -> None:
    """Notify users about unpaid transactions whose due date has arrived."""
    redis_client = None
    try:
        try:
            redis_client = aioredis.from_url(settings.REDIS_URL)
        except Exception as exc:
            logger.warning("Redis unavailable for bill due checker lock: %s", exc)
            redis_client = None

        if not await acquire_lock_or_proceed(redis_client, _LOCK_KEY, _LOCK_TTL):
            logger.debug("Bill due checker skipped — lock held by another instance")
            return

        now = datetime.now(ZoneInfo("UTC"))

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(FinancialTransaction).where(
                    FinancialTransaction.is_paid.is_(False),
                    FinancialTransaction.deleted_at.is_(None),
                    FinancialTransaction.due_date <= now,
                    FinancialTransaction.bill_notified_at.is_(None),
                )
            )
            due_txns = list(result.scalars().all())

        if not due_txns:
            return

        notifications = [
            Notification(
                user_id=txn.user_id,
                type="bill_due",
                title=f"Vencimento hoje: {txn.description or 'lançamento sem descrição'}",
                body=f"R$ {txn.amount_brl:.2f} venceu em {txn.due_date.date().isoformat()}. Marque como pago quando quitar.",
            )
            for txn in due_txns
        ]
        due_ids = [txn.id for txn in due_txns]

        async with AsyncSessionLocal() as db:
            await db.execute(
                update(FinancialTransaction)
                .where(FinancialTransaction.id.in_(due_ids))
                .values(bill_notified_at=now)
            )
            db.add_all(notifications)
            await db.commit()

        logger.info("Bill due checker: %d notification(s) sent", len(due_ids))

    except Exception as exc:
        logger.error("Bill due checker job error: %s", exc, exc_info=True)
    finally:
        if redis_client:
            await redis_client.aclose()
