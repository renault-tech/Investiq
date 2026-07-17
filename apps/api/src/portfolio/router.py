"""Portfolio API router."""
import uuid
import logging

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.auth.dependencies import get_current_user
from src.auth.models import User
from src.market_data.dependencies import get_redis as _get_redis
from src.market_data.dependencies import get_user_provider_settings as _get_user_provider_settings
from src.portfolio import service
from src.portfolio.schemas import (
    PortfolioCreate,
    PortfolioResponse,
    PortfolioSummaryResponse,
    PerformancePoint,
    TransactionCreate,
    TransactionResponse,
    BankAccountCreate,
    BankAccountResponse,
    AddPositionRequest,
    PositionResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/portfolios", tags=["portfolios"])


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


@router.put("/{portfolio_id}", response_model=PortfolioResponse)
async def update_portfolio(
    portfolio_id: uuid.UUID,
    body: PortfolioCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a portfolio name."""
    return await service.update_portfolio(portfolio_id, current_user.id, body.name, db)


@router.delete("/{portfolio_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_portfolio(
    portfolio_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a portfolio completely."""
    await service.delete_portfolio(portfolio_id, current_user.id, db)


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


@router.get("/{portfolio_id}/performance", response_model=list[PerformancePoint])
async def get_portfolio_performance(
    portfolio_id: uuid.UUID,
    period: str = Query(default="1y", pattern="^(1m|3m|6m|1y|max)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis=Depends(_get_redis),
    provider_settings: dict = Depends(_get_user_provider_settings),
):
    """Portfolio value over time (snapshots + reconstruction from transactions)."""
    return await service.get_portfolio_performance(
        portfolio_id=portfolio_id,
        user_id=current_user.id,
        period=period,
        db=db,
        redis=redis,
        preferred_provider=provider_settings["preferred"],
        brapi_key=provider_settings["brapi_key"],
    )


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
