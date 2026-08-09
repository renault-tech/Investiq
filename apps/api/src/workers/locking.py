"""Best-effort distributed locking shared by the scheduled jobs.

The lock only matters when multiple app instances could run the same job
concurrently. Without Redis (the case in the current serverless deploy,
where jobs run via an external cron trigger instead of APScheduler), there's
no way to coordinate — but there's also nothing else running concurrently,
so the safe choice is to proceed unlocked rather than abort the job
entirely. Previously a Redis connection failure here (caught by the job's
own broad except) silently skipped the job's real work every single time.
"""
import logging

logger = logging.getLogger(__name__)


async def acquire_lock_or_proceed(redis_client, key: str, ttl_seconds: int) -> bool:
    """Returns True if the job should run now.

    False only when Redis is reachable and another instance genuinely holds
    the lock — never when Redis itself is the thing that's unavailable.
    """
    if redis_client is None:
        return True
    try:
        acquired = await redis_client.set(key, "1", nx=True, px=ttl_seconds * 1000)
        return bool(acquired)
    except Exception as exc:
        logger.warning("Lock %s unavailable (%s) — proceeding without it", key, exc)
        return True
