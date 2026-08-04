"""Credit card / invoice SQLAlchemy models."""
from sqlalchemy import Column, String, Numeric, Boolean, Text, ForeignKey, Date, Integer, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from src.database import Base


class CreditCard(Base):
    __tablename__ = "credit_cards"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    brand = Column(String(20), nullable=True)
    last4 = Column(String(4), nullable=True)
    credit_limit = Column(Numeric(18, 8), nullable=True)
    closing_day = Column(Integer(), nullable=True)
    due_day = Column(Integer(), nullable=True)
    is_active = Column(Boolean(), nullable=False, default=True, server_default=text("TRUE"))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    invoices = relationship("CardInvoice", back_populates="card", cascade="all, delete-orphan")


class CardInvoice(Base):
    __tablename__ = "card_invoices"
    __table_args__ = (
        UniqueConstraint("card_id", "reference_month", name="uq_card_invoices_card_month"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    card_id = Column(UUID(as_uuid=True), ForeignKey("credit_cards.id", ondelete="CASCADE"), nullable=False, index=True)
    reference_month = Column(Date(), nullable=False)
    due_date = Column(Date(), nullable=True)
    status = Column(String(20), nullable=False, default="processing", server_default="processing")
    total_amount = Column(Numeric(18, 8), nullable=True)
    file_name = Column(String(255), nullable=True)
    raw_text = Column(Text(), nullable=True)
    error_message = Column(Text(), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    card = relationship("CreditCard", back_populates="invoices")
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")


class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("card_invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    description = Column(String(255), nullable=False)
    amount = Column(Numeric(18, 8), nullable=False)
    purchase_date = Column(Date(), nullable=True)
    installment_no = Column(Integer(), nullable=True)
    installment_total = Column(Integer(), nullable=True)
    suggested_category_id = Column(UUID(as_uuid=True), ForeignKey("finance_categories.id", ondelete="SET NULL"), nullable=True)
    category_id = Column(UUID(as_uuid=True), ForeignKey("finance_categories.id", ondelete="SET NULL"), nullable=True)
    financial_transaction_id = Column(UUID(as_uuid=True), nullable=True)
    is_ignored = Column(Boolean(), nullable=False, default=False, server_default=text("FALSE"))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    invoice = relationship("CardInvoice", back_populates="items")
