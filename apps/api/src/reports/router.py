"""Monthly report API — PDF or Excel, consolidado ou por carteira."""
import uuid
from datetime import date as dt_date
from typing import Optional

from fastapi import APIRouter, Depends, Query, Response

from src.database import get_db
from src.auth.dependencies import get_current_user
from src.auth.models import User
from src.market_data.dependencies import get_redis as _get_redis
from src.market_data.dependencies import get_user_provider_settings as _get_user_provider_settings
from src.reports import service
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/reports", tags=["reports"])


def _parse_ids(raw: Optional[str]) -> Optional[list[uuid.UUID]]:
    """IDs separados por vírgula. Vazio = todas, consolidado."""
    if not raw:
        return None
    return [uuid.UUID(part) for part in (p.strip() for p in raw.split(",")) if part]


@router.get("/monthly")
async def get_monthly_report(
    month: str = Query(default_factory=lambda: dt_date.today().strftime("%Y-%m")),
    format: str = Query("pdf", pattern="^(pdf|xlsx)$"),
    account_ids: Optional[str] = Query(None, description="IDs de contas separados por vírgula; vazio = consolidado"),
    portfolio_ids: Optional[str] = Query(None, description="IDs de carteiras de investimento; vazio = todas"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis=Depends(_get_redis),
    provider_settings: dict = Depends(_get_user_provider_settings),
):
    """Consolidated finance + investments report for a given month."""
    content = await service.generate_monthly_report(
        user_id=current_user.id,
        user_name=current_user.full_name or current_user.email,
        month=month,
        db=db,
        redis=redis,
        preferred_provider=provider_settings["preferred"],
        brapi_key=provider_settings["brapi_key"],
        fmt=format,
        account_ids=_parse_ids(account_ids),
        portfolio_ids=_parse_ids(portfolio_ids),
    )
    media_type, extension = service.FORMATS[format]
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="relatorio_{month}.{extension}"'},
    )
