"""Finance budget SQLAlchemy model — kept separate from models.py (Área 2
schema) since budgets landed in migration 0007, not 0003."""
from sqlalchemy import Column, String, Numeric, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP
from sqlalchemy.sql import func

from src.database import Base


class FinanceBudget(Base):
    __tablename__ = "finance_budgets"
    __table_args__ = (
        UniqueConstraint("user_id", "category_id", name="uq_finance_budgets_user_category"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = Column(UUID(as_uuid=True), ForeignKey("finance_categories.id", ondelete="CASCADE"), nullable=False)
    # NULL = orçamento consolidado (vale para o total de todas as carteiras).
    bank_account_id = Column(
        UUID(as_uuid=True), ForeignKey("bank_accounts.id", ondelete="CASCADE"), nullable=True, index=True
    )
    amount = Column(Numeric(18, 8), nullable=False)
    period = Column(String(10), nullable=False, default="monthly", server_default="monthly")
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
