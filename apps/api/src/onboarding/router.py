"""Onboarding checklist status API."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.auth.dependencies import get_current_user
from src.auth.models import User
from src.onboarding import service
from src.onboarding.schemas import OnboardingStatusResponse

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


@router.get("/status", response_model=OnboardingStatusResponse)
async def get_onboarding_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Which of the getting-started steps this user has already completed."""
    return await service.get_onboarding_status(current_user.id, db)
