"""Settings endpoints: GET/PATCH /settings, PUT /settings/api-keys."""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.auth.dependencies import get_current_user
from src.auth.models import User
from src.settings import service
from src.settings.schemas import SettingsResponse, SettingsPatchRequest, ApiKeysUpdateRequest
from src.shared.limiter import limiter

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=SettingsResponse)
async def get_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_settings(current_user.id, db)


@router.patch("", response_model=SettingsResponse)
async def patch_settings(
    body: SettingsPatchRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.update_settings(current_user.id, body, db)


@router.put("/api-keys", response_model=SettingsResponse)
@limiter.limit("10/minute")
async def update_api_keys(
    request: Request,
    body: ApiKeysUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update encrypted API keys. 10/min limit to prevent brute-force enumeration."""
    return await service.update_api_keys(current_user.id, body, db)
