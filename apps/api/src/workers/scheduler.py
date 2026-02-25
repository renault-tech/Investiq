"""APScheduler lifecycle management for background jobs."""
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from src.workers.price_refresh import price_refresh_job
from src.workers.alert_checker import alert_checker_job
from src.workers.fx_updater import fx_update_job

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None


def create_scheduler() -> AsyncIOScheduler:
    """Build and configure the scheduler (does NOT start it)."""
    scheduler = AsyncIOScheduler(timezone="UTC")

    # Price refresh: every 5 minutes (only runs during market hours — checked inside job)
    scheduler.add_job(
        price_refresh_job,
        "interval",
        minutes=5,
        id="price_refresh",
        replace_existing=True,
        misfire_grace_time=60,
    )

    # Alert checking: every 1 minute
    scheduler.add_job(
        alert_checker_job,
        "interval",
        minutes=1,
        id="alert_checker",
        replace_existing=True,
        misfire_grace_time=30,
    )

    # FX rate update: daily at 18:00 UTC
    scheduler.add_job(
        fx_update_job,
        "cron",
        hour=18,
        minute=0,
        id="fx_update",
        replace_existing=True,
        misfire_grace_time=3600,
    )

    return scheduler


def start_scheduler() -> AsyncIOScheduler:
    """Create, configure, and start the scheduler."""
    global _scheduler
    _scheduler = create_scheduler()
    _scheduler.start()
    logger.info("APScheduler started (%d jobs)", len(_scheduler.get_jobs()))
    return _scheduler


def stop_scheduler() -> None:
    """Gracefully stop the scheduler if running."""
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("APScheduler stopped")


def get_scheduler() -> AsyncIOScheduler | None:
    return _scheduler
