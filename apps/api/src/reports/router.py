"""Monthly PDF report API."""
from datetime import date as dt_date

from fastapi import APIRouter, Depends, Query, Response

from src.database import get_db
from src.auth.dependencies import get_current_user
from src.auth.models import User
from src.market_data.dependencies import get_redis as _get_redis
from src.market_data.dependencies import get_user_provider_settings as _get_user_provider_settings
from src.reports import service
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/monthly")
async def get_monthly_report(
    month: str = Query(default_factory=lambda: dt_date.today().strftime("%Y-%m")),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis=Depends(_get_redis),
    provider_settings: dict = Depends(_get_user_provider_settings),
):
    """Consolidated finance + investments PDF report for a given month."""
    pdf_bytes = await service.generate_monthly_report(
        user_id=current_user.id,
        user_name=current_user.full_name or current_user.email,
        month=month,
        db=db,
        redis=redis,
        preferred_provider=provider_settings["preferred"],
        brapi_key=provider_settings["brapi_key"],
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="relatorio_{month}.pdf"'},
    )
