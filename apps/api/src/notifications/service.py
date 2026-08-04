"""Notification business logic — create, list, mark read."""
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, func as sa_func, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.notifications.models import Notification
from src.shared.exceptions import NotFoundError


async def create_notification(
    user_id: uuid.UUID, notif_type: str, title: str, body: Optional[str], db: AsyncSession
) -> Notification:
    notif = Notification(user_id=user_id, type=notif_type, title=title, body=body)
    db.add(notif)
    await db.commit()
    await db.refresh(notif)
    return notif


async def list_notifications(
    user_id: uuid.UUID, db: AsyncSession, *, unread_only: bool = False, limit: int = 50
) -> dict:
    query = select(Notification).where(Notification.user_id == user_id)
    if unread_only:
        query = query.where(Notification.read_at.is_(None))
    query = query.order_by(Notification.created_at.desc()).limit(limit)

    result = await db.execute(query)
    items = list(result.scalars().all())

    unread_result = await db.execute(
        select(sa_func.count(Notification.id)).where(
            Notification.user_id == user_id, Notification.read_at.is_(None)
        )
    )
    return {"items": items, "unread_count": unread_result.scalar() or 0}


async def mark_read(notification_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> Notification:
    result = await db.execute(
        select(Notification).where(Notification.id == notification_id, Notification.user_id == user_id)
    )
    notif = result.scalar_one_or_none()
    if not notif:
        raise NotFoundError("Notificação não encontrada")
    notif.read_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(notif)
    return notif


async def mark_all_read(user_id: uuid.UUID, db: AsyncSession) -> int:
    result = await db.execute(
        update(Notification)
        .where(Notification.user_id == user_id, Notification.read_at.is_(None))
        .values(read_at=datetime.now(timezone.utc))
    )
    await db.commit()
    return result.rowcount or 0
