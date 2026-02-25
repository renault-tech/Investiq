"""Business logic for user settings (read, update, API key management)."""
import logging
from uuid import UUID
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.auth.models import UserSettings
from src.settings.schemas import SettingsResponse, SettingsPatchRequest, ApiKeysUpdateRequest
from src.shared.encryption import encrypt, decrypt

logger = logging.getLogger(__name__)


async def get_or_create(user_id: UUID, db: AsyncSession) -> UserSettings:
    """Return existing UserSettings row, or insert defaults if missing.

    Flushes but does NOT commit — callers are responsible for committing.
    """
    result = await db.execute(select(UserSettings).where(UserSettings.user_id == user_id))
    row = result.scalar_one_or_none()
    if row is None:
        row = UserSettings(user_id=user_id)
        db.add(row)
        await db.flush()
    return row


def _to_response(s: UserSettings) -> SettingsResponse:
    return SettingsResponse(
        theme=s.theme,
        accent_color=s.accent_color,
        font_size_scale=s.font_size_scale,
        base_currency=s.base_currency,
        preferred_provider=s.preferred_provider,
        preferred_llm=s.preferred_llm,
        llm_model=s.llm_model,
        notify_price_alerts=s.notify_price_alerts,
        notify_email=s.notify_email,
        has_claude_api_key=bool(s.claude_api_key),
        has_openai_api_key=bool(s.openai_api_key),
        has_gemini_api_key=bool(s.gemini_api_key),
        has_alpha_vantage_key=bool(s.alpha_vantage_key),
        has_brapi_key=bool(s.brapi_key),
        has_polygon_key=bool(s.polygon_key),
        updated_at=s.updated_at,
    )


async def get_settings(user_id: UUID, db: AsyncSession) -> SettingsResponse:
    s = await get_or_create(user_id, db)
    await db.commit()
    return _to_response(s)


async def update_settings(
    user_id: UUID, patch: SettingsPatchRequest, db: AsyncSession
) -> SettingsResponse:
    s = await get_or_create(user_id, db)
    for field, value in patch.model_dump(exclude_none=True).items():
        setattr(s, field, value)
    await db.commit()
    await db.refresh(s)
    return _to_response(s)


async def update_api_keys(
    user_id: UUID, keys: ApiKeysUpdateRequest, db: AsyncSession
) -> SettingsResponse:
    s = await get_or_create(user_id, db)
    key_fields = [
        "claude_api_key",
        "openai_api_key",
        "gemini_api_key",
        "alpha_vantage_key",
        "brapi_key",
        "polygon_key",
    ]
    for field in key_fields:
        value: Optional[str] = getattr(keys, field)
        if value is not None:
            # Empty string clears the key; non-empty encrypts it
            setattr(s, field, encrypt(value) if value else None)
    await db.commit()
    await db.refresh(s)
    return _to_response(s)


def get_decrypted_api_keys(s: UserSettings) -> dict:
    """Return decrypted API keys for internal use by LLM/market providers.

    Never expose this dict in API responses.
    """
    def safe_decrypt(val: Optional[str]) -> Optional[str]:
        if not val:
            return None
        try:
            return decrypt(val)
        except Exception:
            logger.warning("Failed to decrypt API key — key may be corrupt")
            return None

    return {
        "claude_api_key": safe_decrypt(s.claude_api_key),
        "openai_api_key": safe_decrypt(s.openai_api_key),
        "gemini_api_key": safe_decrypt(s.gemini_api_key),
        "alpha_vantage_key": safe_decrypt(s.alpha_vantage_key),
        "brapi_key": safe_decrypt(s.brapi_key),
        "polygon_key": safe_decrypt(s.polygon_key),
    }
