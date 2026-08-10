"""Lotes de importação de extrato (migração 0012).

Um upload gera um lote persistido — não em memória — porque a revisão e a
confirmação são duas requisições HTTP separadas, e em ambiente serverless
nada garante que caiam na mesma instância. Cada linha carrega sua própria
marcação de duplicata, para a tela de revisão decidir o que pré-selecionar.
"""
from sqlalchemy import Boolean, Column, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import TIMESTAMP, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func, text

from src.database import Base


class FinanceImportBatch(Base):
    __tablename__ = "finance_import_batches"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    bank_account_id = Column(UUID(as_uuid=True), ForeignKey("bank_accounts.id", ondelete="SET NULL"), nullable=True)
    file_name = Column(String(255), nullable=False)
    file_type = Column(String(10), nullable=False)  # ofx | csv
    status = Column(String(20), nullable=False, default="pending", server_default="pending")  # pending|confirmed|discarded
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    rows = relationship("FinanceImportRow", back_populates="batch", cascade="all, delete-orphan")


class FinanceImportRow(Base):
    __tablename__ = "finance_import_rows"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    batch_id = Column(UUID(as_uuid=True), ForeignKey("finance_import_batches.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    transaction_date = Column(TIMESTAMP(timezone=True), nullable=False)
    amount = Column(Numeric(18, 8), nullable=False)
    transaction_type = Column(String(10), nullable=False)  # income | expense
    description = Column(String(255), nullable=False)
    external_id = Column(String(100), nullable=True)  # FITID do OFX — chave de dedupe exata

    category_id = Column(UUID(as_uuid=True), ForeignKey("finance_categories.id", ondelete="SET NULL"), nullable=True)

    is_duplicate = Column(Boolean(), nullable=False, default=False, server_default=text("FALSE"))
    duplicate_transaction_id = Column(UUID(as_uuid=True), nullable=True)
    is_selected = Column(Boolean(), nullable=False, default=True, server_default=text("TRUE"))

    created_transaction_id = Column(UUID(as_uuid=True), nullable=True)  # preenchido após confirmar

    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    batch = relationship("FinanceImportBatch", back_populates="rows")
    category = relationship("FinanceCategory")
