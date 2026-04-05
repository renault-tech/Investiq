"""Portfolio business logic — fetch positions, enrich with live prices, calculate summaries."""
import uuid
import logging
from decimal import Decimal
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.portfolio.models import (
    Portfolio, PortfolioPosition, Asset, InvestmentTransaction, BankAccount
)
from src.portfolio.calculations import (
    calculate_position_pnl,
    calculate_market_value,
    calculate_position_weight,
    calculate_portfolio_summary,
    calculate_rebalance_suggestion,
    calculate_weighted_average_cost,
    calculate_transaction_total,
)
from src.market_data.factory import get_provider, get_cache
from src.shared.exceptions import NotFoundError, ForbiddenError, ConflictError

logger = logging.getLogger(__name__)

_ZERO = Decimal("0")


async def get_user_portfolios(user_id: uuid.UUID, db: AsyncSession) -> list[Portfolio]:
    """Return all portfolios for a user."""
    result = await db.execute(
        select(Portfolio)
        .where(Portfolio.user_id == user_id)
        .order_by(Portfolio.is_default.desc(), Portfolio.created_at)
    )
    return list(result.scalars().all())


async def create_portfolio(
    user_id: uuid.UUID,
    name: str,
    description: Optional[str],
    currency: str,
    db: AsyncSession,
) -> Portfolio:
    """Create a new portfolio. First portfolio is automatically set as default."""
    existing = await get_user_portfolios(user_id, db)
    portfolio = Portfolio(
        user_id=user_id,
        name=name,
        description=description,
        currency=currency,
        is_default=len(existing) == 0,
    )
    db.add(portfolio)
    await db.commit()
    await db.refresh(portfolio)
    return portfolio


async def update_portfolio(
    portfolio_id: uuid.UUID,
    user_id: uuid.UUID,
    name: str,
    db: AsyncSession,
) -> Portfolio:
    result = await db.execute(
        select(Portfolio)
        .where(Portfolio.id == portfolio_id)
        .where(Portfolio.user_id == user_id)
    )
    portfolio = result.scalar_one_or_none()
    if not portfolio:
        raise NotFoundError("Portfolio not found")
    portfolio.name = name
    await db.commit()
    return portfolio


async def delete_portfolio(
    portfolio_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession,
):
    result = await db.execute(
        select(Portfolio)
        .where(Portfolio.id == portfolio_id)
        .where(Portfolio.user_id == user_id)
    )
    portfolio = result.scalar_one_or_none()
    if not portfolio:
        raise NotFoundError("Portfolio not found")
    await db.delete(portfolio)
    await db.commit()


async def get_portfolio_summary(
    portfolio_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession,
    redis=None,
    preferred_provider: str = "yahoo",
    brapi_key: Optional[str] = None,
) -> dict:
    """Build full portfolio summary with live prices and P&L."""
    # Fetch portfolio with positions and assets
    result = await db.execute(
        select(Portfolio)
        .options(
            selectinload(Portfolio.positions).selectinload(PortfolioPosition.asset)
        )
        .where(Portfolio.id == portfolio_id)
    )
    portfolio = result.scalar_one_or_none()
    if portfolio is None:
        raise NotFoundError(f"Portfolio {portfolio_id} not found")
    if portfolio.user_id != user_id:
        raise ForbiddenError("Access denied")

    positions = portfolio.positions
    if not positions:
        return {
            "portfolio_id": portfolio_id,
            "portfolio_name": portfolio.name,
            "total_invested_brl": _ZERO,
            "total_market_value_brl": _ZERO,
            "total_pnl_absolute": _ZERO,
            "total_pnl_percent": _ZERO,
            "positions": [],
            "rebalance_suggestions": [],
        }

    # Fetch live prices
    tickers = [p.asset.ticker for p in positions]
    cache = get_cache(redis) if redis else None
    live_prices: dict[str, Decimal] = {}

    if cache:
        cached_quotes = await cache.get_quotes(tickers)
        for ticker, quote in cached_quotes.items():
            live_prices[ticker] = quote.price
        missing = [t for t in tickers if t not in live_prices]
    else:
        missing = tickers

    if missing:
        provider = get_provider(preferred_provider, brapi_key)
        fresh_quotes = await provider.get_quotes(missing)
        for ticker, quote in fresh_quotes.items():
            live_prices[ticker] = quote.price
        if cache:
            await cache.set_quotes(fresh_quotes)

    # Build per-position data
    position_data = []
    for pos in positions:
        asset = pos.asset
        ticker = asset.ticker
        current_price = live_prices.get(ticker)
        if current_price is None:
            current_price = asset.last_price or _ZERO

        market_value = calculate_market_value(pos.quantity, current_price)
        pnl_abs, pnl_pct = calculate_position_pnl(pos.quantity, pos.avg_cost, current_price)

        position_data.append({
            "position_id": pos.id,
            "asset_id": pos.asset_id,
            "ticker": ticker,
            "asset_name": asset.name,
            "asset_type": asset.asset_type,
            "broker": pos.broker,
            "quantity": pos.quantity,
            "avg_cost": pos.avg_cost,
            "current_price": current_price,
            "market_value_brl": market_value,
            "cost_basis_brl": pos.total_invested,
            "pnl_absolute": pnl_abs,
            "pnl_percent": pnl_pct,
            "target_weight": pos.target_weight,
            "fx_rate_to_brl": Decimal("1"),  # TODO: multi-currency FX lookup
        })

    # Aggregate portfolio summary
    summary = calculate_portfolio_summary(position_data)
    total_value = summary["total_market_value_brl"]

    # Add weights and rebalance
    for pos_dict in position_data:
        pos_dict["weight"] = calculate_position_weight(
            pos_dict["market_value_brl"], total_value
        )

    rebalance = calculate_rebalance_suggestion(position_data, total_value)
    rebalance_map = {r["asset_id"]: r for r in rebalance}

    # Build PositionSummary list
    position_summaries = []
    for pos_dict in position_data:
        reb = rebalance_map.get(pos_dict["asset_id"])
        position_summaries.append({
            **pos_dict,
            "rebalance_action": reb["action"] if reb else None,
            "rebalance_delta_units": reb["delta_units"] if reb else None,
        })

    return {
        "portfolio_id": portfolio_id,
        "portfolio_name": portfolio.name,
        **summary,
        "positions": position_summaries,
        "rebalance_suggestions": rebalance,
    }


async def record_transaction(
    position_id: uuid.UUID,
    user_id: uuid.UUID,
    transaction_type: str,
    quantity: Decimal,
    unit_price: Decimal,
    fees: Decimal,
    fx_rate: Decimal,
    transaction_date,
    notes: Optional[str],
    db: AsyncSession,
) -> InvestmentTransaction:
    """Record an investment transaction and update position avg cost/quantity."""
    # Join through Portfolio to enforce ownership at the DB level
    result = await db.execute(
        select(PortfolioPosition)
        .join(Portfolio, Portfolio.id == PortfolioPosition.portfolio_id)
        .where(PortfolioPosition.id == position_id)
        .where(Portfolio.user_id == user_id)
    )
    position = result.scalar_one_or_none()
    if position is None:
        raise NotFoundError(f"Position {position_id} not found")

    total_amount = calculate_transaction_total(quantity, unit_price, fees, fx_rate)

    if transaction_type == "buy":
        new_avg_cost = calculate_weighted_average_cost(
            position.quantity, position.avg_cost, quantity, unit_price, fees
        )
        position.quantity = position.quantity + quantity
        position.avg_cost = new_avg_cost
        position.total_invested = position.total_invested + total_amount
    elif transaction_type == "sell":
        new_qty = position.quantity - quantity
        if new_qty < _ZERO:
            raise ValueError("Sell quantity exceeds current position")
        # Reduce total_invested proportionally to the fraction sold
        if position.quantity > _ZERO:
            sold_fraction = quantity / position.quantity
            position.total_invested = position.total_invested * (1 - sold_fraction)
        position.quantity = new_qty
        # avg_cost unchanged on sell

    txn = InvestmentTransaction(
        position_id=position_id,
        user_id=user_id,
        transaction_type=transaction_type,
        quantity=quantity,
        unit_price=unit_price,
        fees=fees,
        fx_rate=fx_rate,
        total_amount=total_amount,
        transaction_date=transaction_date,
        notes=notes,
    )
    db.add(txn)
    await db.commit()
    await db.refresh(txn)
    return txn


async def add_position(
    portfolio_id: uuid.UUID,
    user_id: uuid.UUID,
    ticker: str,
    broker: Optional[str],
    target_weight: Optional[Decimal],
    db: AsyncSession,
) -> dict:
    """Add a new asset position to a portfolio (quantity=0, avg_cost=0)."""
    # 1. Verify ownership
    result = await db.execute(
        select(Portfolio)
        .where(Portfolio.id == portfolio_id)
        .where(Portfolio.user_id == user_id)
    )
    portfolio = result.scalar_one_or_none()
    if portfolio is None:
        raise NotFoundError(f"Portfolio {portfolio_id}")

    # 2. Fetch or create Asset
    ticker_upper = ticker.upper().strip()
    result = await db.execute(select(Asset).where(Asset.ticker == ticker_upper))
    asset = result.scalar_one_or_none()
    if asset is None:
        # Create minimal asset record — prices will be fetched on next summary call
        asset = Asset(ticker=ticker_upper, name=ticker_upper, asset_type="stock", currency="BRL")
        db.add(asset)
        await db.flush()

    # 3. Check for duplicate
    result = await db.execute(
        select(PortfolioPosition)
        .where(PortfolioPosition.portfolio_id == portfolio_id)
        .where(PortfolioPosition.asset_id == asset.id)
        .where(PortfolioPosition.broker == broker)
    )
    if result.scalar_one_or_none() is not None:
        raise ConflictError(f"Position for {ticker_upper} already exists in this portfolio")

    # 4. Create position
    position = PortfolioPosition(
        portfolio_id=portfolio_id,
        user_id=user_id,
        asset_id=asset.id,
        broker=broker,
        quantity=Decimal("0"),
        avg_cost=Decimal("0"),
        total_invested=Decimal("0"),
        target_weight=target_weight,
    )
    db.add(position)
    await db.commit()
    await db.refresh(position)
    # Return plain dict — avoids ORM expiry issues with the non-mapped ticker field
    return {
        "id": position.id,
        "portfolio_id": position.portfolio_id,
        "asset_id": position.asset_id,
        "ticker": ticker_upper,
        "broker": position.broker,
        "quantity": position.quantity,
        "avg_cost": position.avg_cost,
        "target_weight": position.target_weight,
        "created_at": position.created_at,
    }
