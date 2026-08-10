"""Bank/wallet account models (migração 0011).

A tabela `bank_accounts` nasceu na migração 0002, dentro do módulo de
portfólio, e nunca foi ligada: zero endpoints, zero serviço, nenhuma leitura.
Ela é um conceito de finanças, não de investimentos, então o model mora aqui
a partir da 0011 — a tabela é a mesma, só mudou de dono.

Saldo é sempre derivado (ver `service.get_account_balances`), nunca guardado:
o módulo de cartões escreve transações por fora do serviço de finanças, e
soft-delete + importação de extrato tornariam qualquer total mantido à mão
divergente com o tempo. `opening_balance` é só o ponto de partida — o saldo
que a conta tinha antes da primeira transação registrada aqui.
"""
from decimal import Decimal

from sqlalchemy import Boolean, Column, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import TIMESTAMP, UUID
from sqlalchemy.sql import func, text

from src.database import Base

ACCOUNT_TYPES = ("checking", "savings", "cash", "investment", "other")


class BankAccount(Base):
    __tablename__ = "bank_accounts"
    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_bank_accounts_user_name"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    institution = Column(String(100), nullable=True)
    account_type = Column(String(20), nullable=False, default="checking", server_default="checking")

    # Rótulo livre do titular ("Eu", "Minha mãe"). É o que permite administrar
    # a conta de outra pessoa sem multiusuário: agrupa e filtra, não isola.
    holder = Column(String(80), nullable=True)

    opening_balance = Column(Numeric(18, 8), nullable=False, default=Decimal("0"), server_default=text("0"))
    currency = Column(String(10), nullable=False, default="BRL", server_default="BRL")
    color = Column(String(7), nullable=True)
    icon = Column(String(50), nullable=True)

    # Fora do total consolidado (ex.: conta de terceiro que você só administra).
    include_in_total = Column(Boolean(), nullable=False, default=True, server_default=text("TRUE"))

    # Conta do tipo `investment` pode espelhar um portfólio: transferir para
    # ela é registrar um aporte.
    portfolio_id = Column(UUID(as_uuid=True), ForeignKey("portfolios.id", ondelete="SET NULL"), nullable=True)

    is_active = Column(Boolean(), nullable=False, default=True, server_default=text("TRUE"))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
