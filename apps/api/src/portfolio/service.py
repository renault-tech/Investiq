"""Portfolio business logic — fetch positions, enrich with live prices, calculate summaries."""
import asyncio
import uuid
import logging
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.portfolio.models import (
    Portfolio, PortfolioPosition, Asset, InvestmentTransaction,
    PortfolioSnapshot,
)
from src.portfolio.calculations import (
    calculate_position_pnl,
    calculate_market_value,
    calculate_position_weight,
    calculate_portfolio_summary,
    calculate_rebalance_suggestion,
    calculate_weighted_average_cost,
    calculate_transaction_total,
    calculate_yield_on_cost,
)
from src.market_data.factory import get_provider, get_cache
from src.market_data.base import default_currency_for_ticker
from src.market_data.bcb import get_cdi_daily_rates
from src.shared.decimal_utils import multiply, pct_change, round_financial
from src.shared.exceptions import NotFoundError, ForbiddenError, ConflictError, ValidationError
from src.shared.fx import get_fx_rates_to_brl as _get_fx_rates_to_brl

logger = logging.getLogger(__name__)

_ZERO = Decimal("0")
_ONE = Decimal("1")


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
            "allocation_by_type": [],
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
    fx_rates = await _get_fx_rates_to_brl({p.asset.currency for p in positions}, db)

    position_data = []
    for pos in positions:
        asset = pos.asset
        ticker = asset.ticker
        current_price = live_prices.get(ticker)
        if current_price is None:
            current_price = asset.last_price or _ZERO

        fx_rate = fx_rates.get(asset.currency, _ONE)
        # current_price is in the asset's native currency; avg_cost/total_invested
        # are already BRL (each transaction converted at its own historical fx_rate),
        # so only the live valuation needs today's rate applied here.
        current_price_native = current_price
        current_price_brl = multiply(current_price, fx_rate)
        market_value = calculate_market_value(pos.quantity, current_price_brl)
        market_value_native = calculate_market_value(pos.quantity, current_price_native)
        pnl_abs, pnl_pct = calculate_position_pnl(pos.quantity, pos.avg_cost, current_price_brl)

        position_data.append({
            "position_id": pos.id,
            "asset_id": pos.asset_id,
            "ticker": ticker,
            "asset_name": asset.name,
            "asset_type": asset.asset_type,
            "broker": pos.broker,
            "quantity": pos.quantity,
            "avg_cost": pos.avg_cost,
            "currency": asset.currency,
            "current_price": current_price_brl,
            "current_price_native": current_price_native,
            "market_value_brl": market_value,
            "market_value_native": market_value_native,
            "cost_basis_brl": pos.total_invested,
            "pnl_absolute": pnl_abs,
            "pnl_percent": pnl_pct,
            "target_weight": pos.target_weight,
            "fx_rate_to_brl": fx_rate,
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

    # Allocation grouped by asset type
    allocation_totals: dict[str, Decimal] = {}
    for pos_dict in position_data:
        asset_type = pos_dict["asset_type"]
        allocation_totals[asset_type] = (
            allocation_totals.get(asset_type, _ZERO) + pos_dict["market_value_brl"]
        )
    allocation_by_type = [
        {
            "asset_type": asset_type,
            "value": value,
            "weight": value / total_value if total_value > _ZERO else _ZERO,
        }
        for asset_type, value in sorted(
            allocation_totals.items(), key=lambda kv: kv[1], reverse=True
        )
    ]

    return {
        "portfolio_id": portfolio_id,
        "portfolio_name": portfolio.name,
        **summary,
        "positions": position_summaries,
        "rebalance_suggestions": rebalance,
        "allocation_by_type": allocation_by_type,
    }


_PERIOD_DAYS = {"1m": 30, "3m": 91, "6m": 182, "1y": 365}
# Provider period strings large enough to cover each requested range
_PERIOD_TO_PROVIDER = {"1m": "3mo", "3m": "6mo", "6m": "1y", "1y": "2y", "max": "max"}


def _build_date_grid(start: date, end: date, weekly: bool) -> list[date]:
    step = timedelta(days=7 if weekly else 1)
    grid = []
    current = start
    while current <= end:
        grid.append(current)
        current += step
    if grid and grid[-1] != end:
        grid.append(end)
    return grid


async def get_portfolio_performance(
    portfolio_id: uuid.UUID,
    user_id: uuid.UUID,
    period: str,
    db: AsyncSession,
    redis=None,
    preferred_provider: str = "yahoo",
    brapi_key: Optional[str] = None,
) -> list[dict]:
    """Time series of portfolio value: [{date, total_value, total_invested}].

    Uses daily snapshots where they exist; earlier dates are reconstructed from
    the transaction history priced with cached historical closes. Grid is daily,
    except weekly for period=max to bound provider/CPU cost.
    """
    result = await db.execute(
        select(Portfolio)
        .options(
            selectinload(Portfolio.positions).selectinload(PortfolioPosition.asset),
            selectinload(Portfolio.positions).selectinload(PortfolioPosition.transactions),
        )
        .where(Portfolio.id == portfolio_id)
    )
    portfolio = result.scalar_one_or_none()
    if portfolio is None:
        raise NotFoundError(f"Portfolio {portfolio_id} not found")
    if portfolio.user_id != user_id:
        raise ForbiddenError("Access denied")

    # Flatten transactions with their ticker
    txns = []
    for pos in portfolio.positions:
        for txn in pos.transactions:
            if txn.transaction_type in ("buy", "sell"):
                txns.append((txn.transaction_date.date(), pos.asset.ticker, txn))
    if not txns:
        return []
    txns.sort(key=lambda t: t[0])

    today = date.today()
    first_txn_date = txns[0][0]
    if period == "max":
        start = first_txn_date
    else:
        days = _PERIOD_DAYS.get(period, 365)
        start = max(today - timedelta(days=days), first_txn_date)

    grid = _build_date_grid(start, today, weekly=(period == "max"))

    # Snapshots available in range, keyed by date
    snap_result = await db.execute(
        select(PortfolioSnapshot)
        .where(PortfolioSnapshot.portfolio_id == portfolio_id)
        .where(PortfolioSnapshot.snapshot_date >= start)
        .order_by(PortfolioSnapshot.snapshot_date)
    )
    snapshots = {s.snapshot_date: s for s in snap_result.scalars().all()}

    # Historical closes per ticker (cache-first), only for dates not covered by snapshots
    tickers = sorted({ticker for _, ticker, _ in txns})
    provider_period = _PERIOD_TO_PROVIDER.get(period, "max")
    cache = get_cache(redis) if redis else None
    provider = get_provider(preferred_provider, brapi_key)

    async def _fetch_closes(ticker: str) -> list[tuple[date, Decimal]]:
        bars = None
        if cache:
            bars = await cache.get_historical(ticker, provider_period, "1d")
        if not bars:
            try:
                bars = await provider.get_historical(ticker, provider_period, "1d")
            except Exception as exc:
                logger.warning("History fetch failed for %s: %s", ticker, exc)
                bars = []
            if cache and bars:
                await cache.set_historical(ticker, bars, provider_period, "1d")
        return sorted(
            ((bar.date.date() if hasattr(bar.date, "date") else bar.date, bar.close) for bar in bars),
            key=lambda item: item[0],
        )

    # Um round-trip por ticker (cache ou provedor) — em série isso é a
    # latência dominante da rota com uma carteira de 10+ ativos; em paralelo
    # vira o tempo do mais lento, não a soma de todos.
    closes_list = await asyncio.gather(*(_fetch_closes(t) for t in tickers))
    closes: dict[str, list[tuple[date, Decimal]]] = dict(zip(tickers, closes_list))

    def close_at(ticker: str, day: date) -> Optional[Decimal]:
        """Most recent close on or before the given date."""
        best = None
        for bar_date, close in closes.get(ticker, []):
            if bar_date <= day:
                best = close
            else:
                break
        return best

    series = []
    for day in grid:
        snap = snapshots.get(day)
        if snap:
            series.append({
                "date": day,
                "total_value": snap.total_value,
                "total_invested": snap.total_invested,
            })
            continue

        # Reconstruct from transactions accumulated up to this date
        qty: dict[str, Decimal] = {}
        invested = _ZERO
        for txn_date, ticker, txn in txns:
            if txn_date > day:
                break
            if txn.transaction_type == "buy":
                qty[ticker] = qty.get(ticker, _ZERO) + txn.quantity
                invested += txn.total_amount
            else:  # sell
                qty[ticker] = qty.get(ticker, _ZERO) - txn.quantity
                invested -= txn.total_amount

        total_value = _ZERO
        for ticker, quantity in qty.items():
            if quantity <= _ZERO:
                continue
            price = close_at(ticker, day)
            if price is not None:
                total_value += quantity * price
        series.append({
            "date": day,
            "total_value": total_value,
            "total_invested": invested if invested > _ZERO else _ZERO,
        })

    return series


def _compound_index(rates: list[tuple[date, Decimal]]) -> list[tuple[date, Decimal]]:
    """Turn daily % rates into a cumulative compounded index, sorted by date."""
    cum = _ONE
    index = []
    for day, rate_pct in sorted(rates):
        cum = cum * (_ONE + rate_pct / Decimal("100"))
        index.append((day, cum))
    return index


def _value_at(series: list[tuple[date, Decimal]], day: date) -> Optional[Decimal]:
    """Latest value at or before `day` in a (date, Decimal) series sorted by date."""
    best = None
    for d, v in series:
        if d <= day:
            best = v
        else:
            break
    return best


async def get_portfolio_benchmark(
    portfolio_id: uuid.UUID,
    user_id: uuid.UUID,
    period: str,
    db: AsyncSession,
    redis=None,
    preferred_provider: str = "yahoo",
    brapi_key: Optional[str] = None,
) -> list[dict]:
    """Portfolio cumulative % return vs. CDI and Ibovespa over the same window.

    Reuses get_portfolio_performance's value series as the portfolio leg. This
    is a simplification, not a true time-weighted return: a contribution made
    mid-window shows up as a jump in the line rather than being cash-flow
    adjusted. Good enough for a quick visual "how am I doing vs. CDI/Ibov"
    comparison, not for precise performance attribution.

    CDI (BCB SGS série 12) and Ibovespa (^BVSP via the configured market data
    provider) each degrade independently to null for dates where their data
    isn't available — a fetch failure on one benchmark never blocks the other
    or the portfolio leg.
    """
    series = await get_portfolio_performance(
        portfolio_id, user_id, period, db, redis, preferred_provider, brapi_key
    )
    if not series:
        return []

    base_value = series[0]["total_value"]
    start_date = series[0]["date"]
    end_date = series[-1]["date"]

    cdi_rates = await get_cdi_daily_rates(start_date, end_date, redis)
    cdi_index = _compound_index(cdi_rates)
    cdi_base = cdi_index[0][1] if cdi_index else None

    ibov_bars: list[tuple[date, Decimal]] = []
    try:
        provider_period = _PERIOD_TO_PROVIDER.get(period, "max")
        cache = get_cache(redis) if redis else None
        bars = await cache.get_historical("^BVSP", provider_period, "1d") if cache else None
        if not bars:
            provider = get_provider(preferred_provider, brapi_key)
            bars = await provider.get_historical("^BVSP", provider_period, "1d")
            if cache and bars:
                await cache.set_historical("^BVSP", bars, provider_period, "1d")
        ibov_bars = sorted(
            ((b.date.date() if hasattr(b.date, "date") else b.date, b.close) for b in bars),
            key=lambda item: item[0],
        )
    except Exception as exc:
        logger.warning("Ibovespa history fetch failed: %s", exc)
    ibov_base = ibov_bars[0][1] if ibov_bars else None

    result = []
    for point in series:
        day = point["date"]
        portfolio_pct = (
            round_financial(pct_change(point["total_value"], base_value))
            if base_value > _ZERO else round_financial(_ZERO)
        )

        cdi_val = _value_at(cdi_index, day)
        cdi_pct = round_financial(pct_change(cdi_val, cdi_base)) if cdi_base and cdi_val is not None else None

        ibov_val = _value_at(ibov_bars, day)
        ibov_pct = round_financial(pct_change(ibov_val, ibov_base)) if ibov_base and ibov_val is not None else None

        result.append({
            "date": day,
            "portfolio_pct": portfolio_pct,
            "cdi_pct": cdi_pct,
            "ibov_pct": ibov_pct,
        })
    return result


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
        # avg_cost is stored in BRL (like total_invested), so unit_price/fees —
        # both in the asset's native currency — must be converted here too.
        unit_price_brl = multiply(unit_price, fx_rate)
        fees_brl = multiply(fees, fx_rate)
        new_avg_cost = calculate_weighted_average_cost(
            position.quantity, position.avg_cost, quantity, unit_price_brl, fees_brl
        )
        position.quantity = position.quantity + quantity
        position.avg_cost = new_avg_cost
        position.total_invested = position.total_invested + total_amount
    elif transaction_type == "sell":
        new_qty = position.quantity - quantity
        if new_qty < _ZERO:
            raise ValidationError("Sell quantity exceeds current position")
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
        asset = Asset(
            ticker=ticker_upper, name=ticker_upper, asset_type="stock",
            currency=default_currency_for_ticker(ticker_upper),
        )
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


async def get_portfolio_income(
    portfolio_id: uuid.UUID, user_id: uuid.UUID, year: int, db: AsyncSession,
) -> dict:
    """Dividend income for a portfolio: monthly series for `year` + trailing-12m
    yield-on-cost per asset (as of today, independent of `year`)."""
    result = await db.execute(
        select(Portfolio)
        .options(
            selectinload(Portfolio.positions).selectinload(PortfolioPosition.asset),
            selectinload(Portfolio.positions).selectinload(PortfolioPosition.transactions),
        )
        .where(Portfolio.id == portfolio_id)
    )
    portfolio = result.scalar_one_or_none()
    if portfolio is None:
        raise NotFoundError(f"Portfolio {portfolio_id} not found")
    if portfolio.user_id != user_id:
        raise ForbiddenError("Access denied")

    today = date.today()
    trailing_12m_start = today - timedelta(days=365)

    months = {f"{year}-{m:02d}": _ZERO for m in range(1, 13)}

    total = _ZERO
    by_asset: dict[str, dict] = {}

    for position in portfolio.positions:
        ticker = position.asset.ticker
        dividends_12m = _ZERO
        for txn in position.transactions:
            if txn.transaction_type != "dividend":
                continue
            txn_date = txn.transaction_date.date() if hasattr(txn.transaction_date, "date") else txn.transaction_date
            if txn_date.year == year:
                key = f"{year}-{txn_date.month:02d}"
                months[key] = months[key] + txn.total_amount
                total += txn.total_amount
            if txn_date >= trailing_12m_start:
                dividends_12m += txn.total_amount

        if dividends_12m > _ZERO or position.quantity > _ZERO:
            by_asset[ticker] = {
                "ticker": ticker,
                "total_12m": dividends_12m,
                "yield_on_cost": calculate_yield_on_cost(dividends_12m, position.total_invested),
            }

    monthly_series = [{"month": k, "amount": v} for k, v in sorted(months.items())]
    by_asset_list = sorted(by_asset.values(), key=lambda a: a["total_12m"], reverse=True)

    return {"year": year, "total": total, "monthly_series": monthly_series, "by_asset": by_asset_list}
