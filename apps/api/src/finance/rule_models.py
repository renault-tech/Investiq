"""Regras de categorização automática (migração 0013).

Uma linha por (usuário, chave normalizada de estabelecimento) — o índice
único garante isso, o que simplifica a busca: nunca há mais de uma regra
concorrendo pela mesma chave, então "precedência" na prática é "a correção
do usuário sempre vence a sugestão anterior", não uma cadeia de prioridades.
"""
from sqlalchemy import Column, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import TIMESTAMP, UUID
from sqlalchemy.sql import func, text

from src.database import Base


class FinanceCategoryRule(Base):
    __tablename__ = "finance_category_rules"
    __table_args__ = (
        UniqueConstraint("user_id", "pattern", name="uq_finance_category_rules_user_pattern"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    pattern = Column(String(100), nullable=False)  # chave normalizada de estabelecimento
    match_type = Column(String(10), nullable=False, default="exact", server_default="exact")
    category_id = Column(UUID(as_uuid=True), ForeignKey("finance_categories.id", ondelete="CASCADE"), nullable=False)
    # learned = o usuário categorizou/corrigiu; ai = sugestão aceita da IA.
    # Uma correção do usuário sempre sobrescreve para 'learned', mesmo que a
    # regra tenha nascido 'ai' — é o sinal mais forte que existe.
    source = Column(String(10), nullable=False, default="learned", server_default="learned")
    hit_count = Column(Integer(), nullable=False, default=0, server_default=text("0"))
    last_used_at = Column(TIMESTAMP(timezone=True), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
