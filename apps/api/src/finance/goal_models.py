"""Savings goal SQLAlchemy models — kept separate from models.py (Área 2
schema) since goals landed in migration 0008, not 0003 (same convention as
budget_models.py for 0007)."""
from sqlalchemy import Column, String, Numeric, Date, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func, text

from src.database import Base


class FinanceGoal(Base):
    __tablename__ = "finance_goals"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    target_amount = Column(Numeric(18, 8), nullable=False)
    current_amount = Column(Numeric(18, 8), nullable=False, default=0, server_default="0")
    target_date = Column(Date, nullable=True)
    color = Column(String(7), nullable=True)
    icon = Column(String(50), nullable=True)
    is_archived = Column(Boolean(), nullable=False, default=False, server_default=text("FALSE"))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    contributions = relationship(
        "FinanceGoalContribution", back_populates="goal", cascade="all, delete-orphan"
    )


class FinanceGoalContribution(Base):
    __tablename__ = "finance_goal_contributions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    goal_id = Column(UUID(as_uuid=True), ForeignKey("finance_goals.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    amount = Column(Numeric(18, 8), nullable=False)  # negative = withdrawal from the goal
    note = Column(String(255), nullable=True)
    contributed_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    goal = relationship("FinanceGoal", back_populates="contributions")
