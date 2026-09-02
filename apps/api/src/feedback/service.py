"""Feedback de usuário — regras."""
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.feedback.models import UserFeedback


async def create_feedback(user_id: uuid.UUID, data: dict, db: AsyncSession) -> UserFeedback:
    feedback = UserFeedback(
        user_id=user_id,
        category=data.get("category") or "other",
        message=data["message"].strip(),
        page_path=data.get("page_path"),
    )
    db.add(feedback)
    await db.commit()
    await db.refresh(feedback)
    return feedback


async def list_feedback(user_id: uuid.UUID, db: AsyncSession) -> list[UserFeedback]:
    """O que a própria pessoa já mandou, mais recente primeiro — sem isso não
    há como saber se o relato chegou nem evitar mandar o mesmo duas vezes."""
    result = await db.execute(
        select(UserFeedback)
        .where(UserFeedback.user_id == user_id)
        .order_by(UserFeedback.created_at.desc())
        .limit(50)
    )
    return list(result.scalars().all())
