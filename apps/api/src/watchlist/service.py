"""Watchlist business logic — tickers a user follows without a portfolio position."""
import uuid
from decimal import Decimal
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.portfolio.models import Asset
from src.watchlist.models import WatchlistItem
from src.market_data.base import default_currency_for_ticker
from src.market_data.factory import get_provider, get_cache
from src.shared.exceptions import ConflictError, NotFoundError


async def _get_or_create_asset(ticker: str, db: AsyncSession) -> Asset:
    ticker_upper = ticker.upper().strip()
    result = await db.execute(select(Asset).where(Asset.ticker == ticker_upper))
    asset = result.scalar_one_or_none()
    if asset is None:
        asset = Asset(
            ticker=ticker_upper, name=ticker_upper, asset_type="stock",
            currency=default_currency_for_ticker(ticker_upper),
        )
        db.add(asset)
        await db.flush()
    return asset


async def add_to_watchlist(user_id: uuid.UUID, ticker: str, db: AsyncSession) -> dict[str, Any]:
    asset = await _get_or_create_asset(ticker, db)

    existing = await db.execute(
        select(WatchlistItem).where(WatchlistItem.user_id == user_id, WatchlistItem.asset_id == asset.id)
    )
    if existing.scalar_one_or_none() is not None:
        raise ConflictError(f"{asset.ticker} já está na watchlist")

    item = WatchlistItem(user_id=user_id, asset_id=asset.id)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return await _to_dict(item, asset, None)


async def list_watchlist(
    user_id: uuid.UUID,
    db: AsyncSession,
    redis=None,
    preferred_provider: str = "yahoo",
    brapi_key: Optional[str] = None,
) -> list[dict[str, Any]]:
    result = await db.execute(
        select(WatchlistItem, Asset)
        .join(Asset, Asset.id == WatchlistItem.asset_id)
        .where(WatchlistItem.user_id == user_id)
        .order_by(WatchlistItem.created_at.desc())
    )
    rows = result.all()
    if not rows:
        return []

    tickers = [asset.ticker for _, asset in rows]
    cache = get_cache(redis) if redis else None
    live_quotes: dict[str, Any] = {}

    if cache:
        live_quotes = await cache.get_quotes(tickers)
        missing = [t for t in tickers if t not in live_quotes]
    else:
        missing = tickers

    if missing:
        provider = get_provider(preferred_provider, brapi_key)
        fresh = await provider.get_quotes(missing)
        live_quotes.update(fresh)
        if cache and fresh:
            await cache.set_quotes(fresh)

    return [await _to_dict(item, asset, live_quotes.get(asset.ticker)) for item, asset in rows]


async def remove_from_watchlist(item_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> None:
    result = await db.execute(
        select(WatchlistItem).where(WatchlistItem.id == item_id, WatchlistItem.user_id == user_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise NotFoundError("Item da watchlist não encontrado")
    await db.delete(item)
    await db.commit()


async def _to_dict(item: WatchlistItem, asset: Asset, quote) -> dict[str, Any]:
    price: Optional[Decimal] = quote.price if quote else asset.last_price
    change_pct: Optional[Decimal] = quote.change_pct if quote else None
    return {
        "id": item.id,
        "ticker": asset.ticker,
        "name": asset.name,
        "asset_type": asset.asset_type,
        "price": price,
        "change_pct": change_pct,
        "currency": asset.currency,
        "created_at": item.created_at,
    }
