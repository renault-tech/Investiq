"""Endpoint for triggering the scheduled jobs from outside the process.

On Vercel the app runs as short-lived serverless functions — there's no
long-running process for APScheduler (src/workers/scheduler.py) to live in,
so ENABLE_SCHEDULER is false in production and none of the four jobs below
ever ran. This endpoint lets an external scheduler (a GitHub Actions cron
workflow — see .github/workflows/scheduled-jobs.yml) invoke them instead,
each on the same cadence the in-process scheduler used to.

Protected by a shared secret rather than user auth: this isn't tied to any
one user's session, and the caller is a CI job, not a browser.
"""
import hmac
import logging

from fastapi import APIRouter, Header, Query

from src.config import settings
from src.shared.exceptions import UnauthorizedError
from src.workers.price_refresh import price_refresh_job
from src.workers.alert_checker import alert_checker_job
from src.workers.fx_updater import fx_update_job
from src.workers.snapshot_worker import snapshot_job

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/internal", tags=["internal"])

_JOBS = {
    "price_refresh": price_refresh_job,
    "alert_checker": alert_checker_job,
    "fx_update": fx_update_job,
    "snapshot": snapshot_job,
}


def _check_secret(x_cron_secret: str | None) -> None:
    if not settings.CRON_SECRET:
        # Refuse to run rather than accept unauthenticated calls just
        # because nobody configured a secret yet.
        raise UnauthorizedError("Scheduled jobs are not configured")
    if not x_cron_secret or not hmac.compare_digest(x_cron_secret, settings.CRON_SECRET):
        raise UnauthorizedError("Invalid or missing cron secret")


@router.post("/jobs/run")
async def run_jobs(
    jobs: str = Query("all", description="Comma-separated job names, or 'all'"),
    x_cron_secret: str | None = Header(default=None),
):
    _check_secret(x_cron_secret)

    names = list(_JOBS.keys()) if jobs == "all" else [j.strip() for j in jobs.split(",") if j.strip()]
    unknown = [n for n in names if n not in _JOBS]
    if unknown:
        return {"error": f"Unknown job(s): {', '.join(unknown)}", "known_jobs": list(_JOBS.keys())}

    results: dict[str, str] = {}
    for name in names:
        try:
            await _JOBS[name]()
            results[name] = "ok"
        except Exception as exc:
            # Each job already logs+swallows its own errors internally;
            # this is a second line of defense so one job's bug can't stop
            # the others in the same request from running.
            logger.error("Job %s raised unexpectedly: %s", name, exc, exc_info=True)
            results[name] = f"error: {exc}"

    return {"results": results}
