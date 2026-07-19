"""Price alert business logic — CRUD over PriceAlert (portfolio/models.py)."""
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.portfolio.models import Asset, PriceAlert
from src.shared.exceptions import NotFoundError


async def _get_or_create_asset(ticker: str, db: AsyncSession) -> Asset:
    ticker_upper = ticker.upper().strip()
    result = await db.execute(select(Asset).where(Asset.ticker == ticker_upper))
    asset = result.scalar_one_or_none()
    if asset is None:
        asset = Asset(ticker=ticker_upper, name=ticker_upper, asset_type="stock", currency="BRL")
        db.add(asset)
        await db.flush()
    return asset


async def create_alert(
    user_id: uuid.UUID, ticker: str, alert_type: str, threshold, db: AsyncSession
) -> dict[str, Any]:
    asset = await _get_or_create_asset(ticker, db)
    alert = PriceAlert(user_id=user_id, asset_id=asset.id, alert_type=alert_type, threshold=threshold)
    db.add(alert)
    await db.commit()
    await db.refresh(alert)
    return _to_dict(alert, asset.ticker)


async def list_alerts(user_id: uuid.UUID, db: AsyncSession) -> list[dict[str, Any]]:
    result = await db.execute(
        select(PriceAlert, Asset)
        .join(Asset, Asset.id == PriceAlert.asset_id)
        .where(PriceAlert.user_id == user_id)
        .order_by(PriceAlert.created_at.desc())
    )
    return [_to_dict(alert, asset.ticker) for alert, asset in result.all()]


async def _get_alert(alert_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> PriceAlert:
    result = await db.execute(
        select(PriceAlert).where(PriceAlert.id == alert_id, PriceAlert.user_id == user_id)
    )
    alert = result.scalar_one_or_none()
    if not alert:
        raise NotFoundError("Alerta não encontrado")
    return alert


async def update_alert(
    alert_id: uuid.UUID, user_id: uuid.UUID, updates: dict, db: AsyncSession
) -> dict[str, Any]:
    alert = await _get_alert(alert_id, user_id, db)
    for field, value in updates.items():
        if value is not None:
            setattr(alert, field, value)
    await db.commit()
    await db.refresh(alert)
    asset_result = await db.execute(select(Asset).where(Asset.id == alert.asset_id))
    asset = asset_result.scalar_one()
    return _to_dict(alert, asset.ticker)


async def delete_alert(alert_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> None:
    alert = await _get_alert(alert_id, user_id, db)
    await db.delete(alert)
    await db.commit()


def _to_dict(alert: PriceAlert, ticker: str) -> dict[str, Any]:
    return {
        "id": alert.id,
        "ticker": ticker,
        "alert_type": alert.alert_type,
        "threshold": alert.threshold,
        "is_active": alert.is_active,
        "triggered_at": alert.triggered_at,
        "created_at": alert.created_at,
    }
