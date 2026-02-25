"""Finance SQLAlchemy models (Área 2 — Receitas/Despesas)."""
from decimal import Decimal
from typing import Optional

from sqlalchemy import Column, String, Numeric, Boolean, Text, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func, text

from src.database import Base


class FinanceCategory(Base):
    __tablename__ = "finance_categories"
    __table_args__ = (
        UniqueConstraint("user_id", "name", "category_type", name="uq_finance_category_user_name_type"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    category_type = Column(String(10), nullable=False)  # income | expense
    color = Column(String(7), nullable=True)
    icon = Column(String(50), nullable=True)
    is_active = Column(Boolean(), nullable=False, default=True, server_default=text("TRUE"))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    transactions = relationship("FinancialTransaction", back_populates="category")


class FinancialTransaction(Base):
    __tablename__ = "financial_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = Column(UUID(as_uuid=True), ForeignKey("finance_categories.id", ondelete="SET NULL"), nullable=True, index=True)
    bank_account_id = Column(UUID(as_uuid=True), ForeignKey("bank_accounts.id", ondelete="SET NULL"), nullable=True, index=True)
    transaction_type = Column(String(10), nullable=False)  # income | expense | transfer
    amount = Column(Numeric(18, 8), nullable=False)
    currency = Column(String(10), nullable=False, default="BRL", server_default="BRL")
    description = Column(String(255), nullable=True)
    notes = Column(Text(), nullable=True)
    transaction_date = Column(TIMESTAMP(timezone=True), nullable=False, index=True)
    is_recurring = Column(Boolean(), nullable=False, default=False, server_default=text("FALSE"))
    recurrence_rule = Column(String(100), nullable=True)
    tags = Column(Text(), nullable=True)  # JSON array of strings
    deleted_at = Column(TIMESTAMP(timezone=True), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    category = relationship("FinanceCategory", back_populates="transactions")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), nullable=True, index=True)  # NULL for system actions
    action = Column(String(100), nullable=False)
    table_name = Column(String(100), nullable=True)
    record_id = Column(UUID(as_uuid=True), nullable=True)
    old_data = Column(Text(), nullable=True)  # JSON
    new_data = Column(Text(), nullable=True)  # JSON
    ip_address = Column(String(45), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
