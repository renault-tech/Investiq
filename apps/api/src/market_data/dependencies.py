"""Shared FastAPI dependencies for market-data-backed endpoints."""
import logging

import redis.asyncio as aioredis
from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.auth.dependencies import get_current_user
from src.auth.models import User, UserSettings

logger = logging.getLogger(__name__)


async def get_redis():
    """Yield a Redis client, closing it after the request. Yields None if unavailable.

    Connection setup is guarded so a broken Redis doesn't break the request; the
    yield itself is NOT guarded — a bare try/except around a generator's yield
    swallows exceptions raised by the route handler too (FastAPI delivers them
    into the generator at that yield point), masking real errors as 500s.
    """
    from src.config import settings
    client = None
    try:
        client = aioredis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)
    except Exception as exc:
        logger.warning("Redis unavailable, cache disabled: %s", exc)
        client = None

    try:
        yield client
    finally:
        if client:
            await client.aclose()


async def get_user_provider_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Fetch the user's preferred market data provider and Brapi key."""
    result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == current_user.id)
    )
    settings_obj = result.scalar_one_or_none()
    return {
        "preferred": settings_obj.preferred_provider if settings_obj else "yahoo",
        "brapi_key": settings_obj.brapi_key if settings_obj else None,
    }
