"""Portfolio API router."""
import uuid
import logging

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.auth.dependencies import get_current_user
from src.auth.models import User, UserSettings
from src.portfolio import service
from src.portfolio.schemas import (
    PortfolioCreate,
    PortfolioResponse,
    PortfolioSummaryResponse,
    TransactionCreate,
    TransactionResponse,
    BankAccountCreate,
    BankAccountResponse,
    AddPositionRequest,
    PositionResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/portfolios", tags=["portfolios"])


async def _get_redis():
    """Dependency: yields Redis client and closes it after request. Yields None if unavailable."""
    from src.config import settings
    client = None
    try:
        client = aioredis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)
        yield client
    except Exception as exc:
        logger.warning("Redis unavailable, cache disabled: %s", exc)
        yield None
    finally:
        if client:
            await client.aclose()


async def _get_user_provider_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Fetch user's preferred market data provider from settings."""
    from sqlalchemy import select
    result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == current_user.id)
    )
    settings_obj = result.scalar_one_or_none()
    return {
        "preferred": settings_obj.preferred_provider if settings_obj else "yahoo",
        "brapi_key": settings_obj.brapi_key if settings_obj else None,
    }


@router.get("/", response_model=list[PortfolioResponse])
async def list_portfolios(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all portfolios for the current user."""
    return await service.get_user_portfolios(current_user.id, db)


@router.post("/", response_model=PortfolioResponse, status_code=status.HTTP_201_CREATED)
async def create_portfolio(
    body: PortfolioCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new portfolio."""
    return await service.create_portfolio(
        current_user.id, body.name, body.description, body.currency, db
    )


@router.get("/{portfolio_id}/summary", response_model=PortfolioSummaryResponse)
async def get_portfolio_summary(
    portfolio_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis=Depends(_get_redis),
    provider_settings: dict = Depends(_get_user_provider_settings),
):
    """Get full portfolio summary with live prices, P&L, and rebalance suggestions."""
    data = await service.get_portfolio_summary(
        portfolio_id=portfolio_id,
        user_id=current_user.id,
        db=db,
        redis=redis,
        preferred_provider=provider_settings["preferred"],
        brapi_key=provider_settings["brapi_key"],
    )
    return data


@router.post("/transactions", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def record_transaction(
    body: TransactionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Record a buy/sell/dividend/split/bonus transaction."""
    txn = await service.record_transaction(
        position_id=body.position_id,
        user_id=current_user.id,
        transaction_type=body.transaction_type,
        quantity=body.quantity,
        unit_price=body.unit_price,
        fees=body.fees,
        fx_rate=body.fx_rate,
        transaction_date=body.transaction_date,
        notes=body.notes,
        db=db,
    )
    return txn


@router.post("/{portfolio_id}/positions", response_model=PositionResponse, status_code=status.HTTP_201_CREATED)
async def add_position_to_portfolio(
    portfolio_id: uuid.UUID,
    body: AddPositionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a new asset position to a portfolio."""
    return await service.add_position(
        portfolio_id=portfolio_id,
        user_id=current_user.id,
        ticker=body.ticker,
        broker=body.broker,
        target_weight=body.target_weight,
        db=db,
    )
