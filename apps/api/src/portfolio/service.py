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


def _compute_xirr(cash_flows: list[tuple[date, Decimal]]) -> Optional[Decimal]:
    """Retorno anualizado ponderado pelo dinheiro (XIRR) — a taxa que zera o
    valor presente de todos os fluxos de caixa: aportes (negativos, dinheiro
    saindo do seu bolso), vendas e dividendos (positivos, dinheiro voltando),
    e o valor de mercado atual como um saque hipotético final (positivo).

    Complementa o TWR (`_compute_twr_series`): TWR mede a performance dos
    ativos em si, neutralizando quando/quanto você aportou — bom pra comparar
    com CDI/Ibovespa. XIRR mede quanto VOCÊ pessoalmente ganhou, no timing
    real dos seus aportes — dois aportes idênticos em ativos idênticos podem
    render TWR igual e XIRR bem diferente se um aporte chegou na véspera de
    uma alta e o outro não.

    Bisseção sobre uma faixa ampla de taxas anuais plausíveis, não
    Newton-Raphson: o VP(taxa) de um XIRR não tem garantia de ser bem
    comportado quando os fluxos não estão em ordem de sinal simples (ex.:
    venda parcial no meio de uma sequência de compras), então Newton pode
    divergir; bisseção é determinística dentro da faixa escolhida — no pior
    caso não encontra raiz (retorna None), nunca diverge para um valor
    absurdo.
    """
    if len(cash_flows) < 2:
        return None
    flows = sorted(cash_flows, key=lambda f: f[0])
    t0 = flows[0][0]
    amounts = [float(amount) for _, amount in flows]
    days = [(d - t0).days for d, _ in flows]

    # Sem os dois sinais representados não existe taxa que zere o VP —
    # carteira só com aportes (nunca vendida/avaliada) ou só com entradas.
    if not any(a > 0 for a in amounts) or not any(a < 0 for a in amounts):
        return None

    def npv(rate: float) -> float:
        return sum(a / (1.0 + rate) ** (d / 365.0) for a, d in zip(amounts, days))

    low, high = -0.999999, 100.0  # -99,9999% a +10.000% ao ano
    npv_low, npv_high = npv(low), npv(high)
    if npv_low * npv_high > 0:
        # VP não muda de sinal nessa faixa inteira — sem raiz encontrável
        # (cenário degenerado, ex.: um único aporte gigante recente com
        # valorização absurda), preferível a devolver um número inventado.
        return None

    mid = (low + high) / 2
    for _ in range(200):
        mid = (low + high) / 2
        npv_mid = npv(mid)
        if abs(npv_mid) < 1e-6:
            break
        if npv_low * npv_mid < 0:
            high = mid
        else:
            low, npv_low = mid, npv_mid

    return round_financial(Decimal(str(mid * 100)))


async def _get_portfolio_cash_flows(
    portfolio_id: uuid.UUID, db: AsyncSession
) -> list[tuple[date, Decimal]]:
    """Fluxos de caixa de toda a carteira pro XIRR: compra sai (negativo),
    venda e dividendo entram (positivo). Split/bonus não trocam dinheiro de
    mãos — só ajustam quantidade — então não geram fluxo nenhum aqui."""
    result = await db.execute(
        select(InvestmentTransaction)
        .join(PortfolioPosition, PortfolioPosition.id == InvestmentTransaction.position_id)
        .where(PortfolioPosition.portfolio_id == portfolio_id)
    )
    flows: list[tuple[date, Decimal]] = []
    for txn in result.scalars().all():
        txn_date = txn.transaction_date.date() if hasattr(txn.transaction_date, "date") else txn.transaction_date
        if txn.transaction_type == "buy":
            flows.append((txn_date, -txn.total_amount))
        elif txn.transaction_type in ("sell", "dividend"):
            flows.append((txn_date, txn.total_amount))
    return flows


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
            "xirr_percent": None,
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

    cash_flows = await _get_portfolio_cash_flows(portfolio_id, db)
    xirr_percent = _compute_xirr([*cash_flows, (date.today(), total_value)]) if cash_flows else None

    return {
        "portfolio_id": portfolio_id,
        "portfolio_name": portfolio.name,
        **summary,
        "xirr_percent": xirr_percent,
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


def _compute_twr_series(series: list[dict]) -> list[dict]:
    """Cumulative time-weighted return (%) from a portfolio value series.

    `series` is `get_portfolio_performance`'s output: daily/weekly points of
    `{date, total_value, total_invested}`. A naive `(value_t / value_0 - 1)`
    reads a mid-period contribution as performance — deposit R$10.000 in
    July and the line jumps, even though not a single real gain happened.
    Comparing that line against CDI/Ibovespa, which never receive a
    contribution, is comparing two different things.

    Daily-linking TWR fixes this: treat each point-over-point change in
    `total_invested` as an external cash flow that happened right before
    that point's valuation, back it out of the sub-period return, then
    chain the sub-period returns geometrically:

        cash_flow_i = invested_i - invested_{i-1}
        r_i         = (value_i - cash_flow_i) / value_{i-1} - 1
        TWR         = prod(1 + r_i) - 1

    This is the standard practical TWR when you have periodic valuations
    instead of exact intraday cash-flow timestamps (the CFA Institute's own
    "linked modified Dietz" approximation) — accurate as long as no more
    than one contribution lands in the same grid step, which for the daily
    grid this app uses everywhere except period=max is the common case.
    """
    if not series:
        return []

    out: list[dict] = [{"date": series[0]["date"], "twr_pct": _ZERO}]
    cumulative = _ONE
    prev_value = series[0]["total_value"]
    prev_invested = series[0]["total_invested"]

    for point in series[1:]:
        value = point["total_value"]
        invested = point["total_invested"]
        cash_flow = invested - prev_invested
        if prev_value > _ZERO:
            sub_return = (value - cash_flow) / prev_value - _ONE
            cumulative *= _ONE + sub_return
        # prev_value <= 0 só acontece com a carteira zerada (sem posição
        # nenhuma) — sem base pra medir retorno, o composto fica parado até
        # a próxima janela com valor de fato.
        out.append({"date": point["date"], "twr_pct": round_financial((cumulative - _ONE) * 100)})
        prev_value = value
        prev_invested = invested

    return out


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


async def _fetch_index_series(ticker: str, provider_period: str, cache, provider) -> list[tuple[date, Decimal]]:
    """Sorted (date, close) history for an index ticker (^BVSP/^IXIC/^GSPC).
    Same cache-then-provider fallback for every index — a fetch failure here
    degrades to an empty series (the benchmark column shows null) rather than
    breaking the whole comparison."""
    try:
        bars = await cache.get_historical(ticker, provider_period, "1d") if cache else None
        if not bars:
            bars = await provider.get_historical(ticker, provider_period, "1d")
            if cache and bars:
                await cache.set_historical(ticker, bars, provider_period, "1d")
        return sorted(
            ((b.date.date() if hasattr(b.date, "date") else b.date, b.close) for b in bars),
            key=lambda item: item[0],
        )
    except Exception as exc:
        logger.warning("%s history fetch failed: %s", ticker, exc)
        return []


async def get_portfolio_benchmark(
    portfolio_id: uuid.UUID,
    user_id: uuid.UUID,
    period: str,
    db: AsyncSession,
    redis=None,
    preferred_provider: str = "yahoo",
    brapi_key: Optional[str] = None,
) -> list[dict]:
    """Portfolio cumulative % return (time-weighted) vs. CDI and Ibovespa over
    the same window.

    The portfolio leg is TWR (see `_compute_twr_series`), not a naive
    `value_t / value_0` — a contribution made mid-window would otherwise show
    up as a jump in the line, inflating "performance" by the deposit itself.
    CDI/Ibovespa never receive a contribution, so comparing them against a
    contribution-inflated line was comparing two different things.

    CDI (BCB SGS série 12) and each index benchmark (Ibovespa/Nasdaq/S&P 500,
    via the configured market data provider) degrade independently to null
    for dates where their data isn't available — a fetch failure on one
    benchmark never blocks the others or the portfolio leg.
    """
    series = await get_portfolio_performance(
        portfolio_id, user_id, period, db, redis, preferred_provider, brapi_key
    )
    if not series:
        return []

    twr_series = _compute_twr_series(series)
    start_date = series[0]["date"]
    end_date = series[-1]["date"]

    cdi_rates = await get_cdi_daily_rates(start_date, end_date, redis)
    cdi_index = _compound_index(cdi_rates)
    cdi_base = cdi_index[0][1] if cdi_index else None

    provider_period = _PERIOD_TO_PROVIDER.get(period, "max")
    cache = get_cache(redis) if redis else None
    provider = get_provider(preferred_provider, brapi_key)
    ibov_bars = await _fetch_index_series("^BVSP", provider_period, cache, provider)
    nasdaq_bars = await _fetch_index_series("^IXIC", provider_period, cache, provider)
    sp500_bars = await _fetch_index_series("^GSPC", provider_period, cache, provider)
    ibov_base = ibov_bars[0][1] if ibov_bars else None
    nasdaq_base = nasdaq_bars[0][1] if nasdaq_bars else None
    sp500_base = sp500_bars[0][1] if sp500_bars else None

    result = []
    for point, twr_point in zip(series, twr_series):
        day = point["date"]
        portfolio_pct = twr_point["twr_pct"]

        cdi_val = _value_at(cdi_index, day)
        cdi_pct = round_financial(pct_change(cdi_val, cdi_base)) if cdi_base and cdi_val is not None else None

        ibov_val = _value_at(ibov_bars, day)
        ibov_pct = round_financial(pct_change(ibov_val, ibov_base)) if ibov_base and ibov_val is not None else None

        nasdaq_val = _value_at(nasdaq_bars, day)
        nasdaq_pct = (
            round_financial(pct_change(nasdaq_val, nasdaq_base)) if nasdaq_base and nasdaq_val is not None else None
        )

        sp500_val = _value_at(sp500_bars, day)
        sp500_pct = (
            round_financial(pct_change(sp500_val, sp500_base)) if sp500_base and sp500_val is not None else None
        )

        result.append({
            "date": day,
            "portfolio_pct": portfolio_pct,
            "cdi_pct": cdi_pct,
            "ibov_pct": ibov_pct,
            "nasdaq_pct": nasdaq_pct,
            "sp500_pct": sp500_pct,
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


def _recompute_position_from_transactions(
    position: PortfolioPosition, transactions: list[InvestmentTransaction]
) -> None:
    """Replay every transaction from scratch to derive quantity/avg_cost/
    total_invested — the only correct way to reflect an edit or a delete.
    Weighted average cost isn't reversible after the fact (a sell doesn't
    remember which buy it came from), so "undo just this one transaction"
    would drift from what a full replay produces the moment there's more
    than a single buy in the history.

    Mirrors record_transaction()'s per-type logic exactly; dividend/split/
    bonus are accepted by the schema but don't mutate the position there
    either, so they're skipped here too — not a gap introduced by this
    function.
    """
    quantity = _ZERO
    avg_cost = _ZERO
    total_invested = _ZERO
    for txn in sorted(transactions, key=lambda t: t.transaction_date):
        if txn.transaction_type == "buy":
            unit_price_brl = multiply(txn.unit_price, txn.fx_rate)
            fees_brl = multiply(txn.fees, txn.fx_rate)
            avg_cost = calculate_weighted_average_cost(quantity, avg_cost, txn.quantity, unit_price_brl, fees_brl)
            quantity = quantity + txn.quantity
            total_invested = total_invested + txn.total_amount
        elif txn.transaction_type == "sell":
            new_qty = quantity - txn.quantity
            if new_qty < _ZERO:
                # Sem essa transação (ou com os novos valores), uma venda
                # posterior deixaria de caber na quantidade disponível —
                # truncar em silêncio corromperia avg_cost/quantidade sem
                # avisar; melhor recusar a edição/exclusão.
                raise ConflictError(
                    "Essa alteração deixaria uma venda posterior maior que a posição disponível. "
                    "Edite ou apague as vendas primeiro."
                )
            if quantity > _ZERO:
                sold_fraction = txn.quantity / quantity
                total_invested = total_invested * (1 - sold_fraction)
            quantity = new_qty
    position.quantity = quantity
    position.avg_cost = avg_cost
    position.total_invested = total_invested


async def _get_owned_position(position_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> PortfolioPosition:
    result = await db.execute(
        select(PortfolioPosition)
        .join(Portfolio, Portfolio.id == PortfolioPosition.portfolio_id)
        .where(PortfolioPosition.id == position_id)
        .where(Portfolio.user_id == user_id)
        .options(selectinload(PortfolioPosition.asset))
    )
    position = result.scalar_one_or_none()
    if position is None:
        raise NotFoundError(f"Position {position_id} not found")
    return position


async def update_position(
    position_id: uuid.UUID,
    user_id: uuid.UUID,
    broker: Optional[str],
    target_weight: Optional[Decimal],
    db: AsyncSession,
    *,
    broker_set: bool = False,
    target_weight_set: bool = False,
) -> dict:
    """Só broker e target_weight são editáveis diretamente — quantidade e
    preço médio são sempre derivados das transações, editar ou apagar uma
    transação é o que os muda."""
    position = await _get_owned_position(position_id, user_id, db)
    if broker_set:
        position.broker = broker
    if target_weight_set:
        position.target_weight = target_weight
    await db.commit()
    await db.refresh(position, attribute_names=["asset"])
    return {
        "id": position.id,
        "portfolio_id": position.portfolio_id,
        "asset_id": position.asset_id,
        "ticker": position.asset.ticker,
        "broker": position.broker,
        "quantity": position.quantity,
        "avg_cost": position.avg_cost,
        "target_weight": position.target_weight,
        "created_at": position.created_at,
    }


async def delete_position(position_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> None:
    """Apaga a posição e, via cascade, todas as transações dela — não há
    histórico parcial de um ativo que o usuário removeu da carteira."""
    position = await _get_owned_position(position_id, user_id, db)
    await db.delete(position)
    await db.commit()


async def update_transaction(
    transaction_id: uuid.UUID,
    user_id: uuid.UUID,
    updates: dict,
    db: AsyncSession,
) -> InvestmentTransaction:
    result = await db.execute(
        select(InvestmentTransaction).where(
            InvestmentTransaction.id == transaction_id, InvestmentTransaction.user_id == user_id
        )
    )
    txn = result.scalar_one_or_none()
    if txn is None:
        raise NotFoundError(f"Transaction {transaction_id} not found")

    for field, value in updates.items():
        setattr(txn, field, value)
    txn.total_amount = calculate_transaction_total(txn.quantity, txn.unit_price, txn.fees, txn.fx_rate)

    position = await _get_owned_position(txn.position_id, user_id, db)
    siblings_result = await db.execute(
        select(InvestmentTransaction).where(InvestmentTransaction.position_id == position.id)
    )
    _recompute_position_from_transactions(position, siblings_result.scalars().all())

    await db.commit()
    await db.refresh(txn)
    return txn


async def list_position_transactions(
    position_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession
) -> list[InvestmentTransaction]:
    """Histórico de uma posição, mais recente primeiro — a lista que permite
    escolher qual transação editar ou apagar."""
    await _get_owned_position(position_id, user_id, db)  # 404 if not owned
    result = await db.execute(
        select(InvestmentTransaction)
        .where(InvestmentTransaction.position_id == position_id)
        .order_by(InvestmentTransaction.transaction_date.desc())
    )
    return result.scalars().all()


async def delete_transaction(transaction_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> None:
    result = await db.execute(
        select(InvestmentTransaction).where(
            InvestmentTransaction.id == transaction_id, InvestmentTransaction.user_id == user_id
        )
    )
    txn = result.scalar_one_or_none()
    if txn is None:
        raise NotFoundError(f"Transaction {transaction_id} not found")

    position = await _get_owned_position(txn.position_id, user_id, db)
    await db.delete(txn)
    await db.flush()

    siblings_result = await db.execute(
        select(InvestmentTransaction).where(InvestmentTransaction.position_id == position.id)
    )
    _recompute_position_from_transactions(position, siblings_result.scalars().all())

    await db.commit()


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
