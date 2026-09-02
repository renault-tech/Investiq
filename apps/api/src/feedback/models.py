"""Feedback de usuário — modelo."""
from sqlalchemy import Column, String, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP
from sqlalchemy.sql import func

from src.database import Base


class UserFeedback(Base):
    __tablename__ = "user_feedback"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    # bug | idea | other — o que a pessoa escolheu no formulário.
    category = Column(String(20), nullable=False)
    message = Column(Text(), nullable=False)
    # Tela de onde o feedback saiu. Preenchida pelo cliente: quase todo
    # relato ("isso aqui está errado") só faz sentido junto do lugar onde a
    # pessoa estava quando escreveu.
    page_path = Column(String(200), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
