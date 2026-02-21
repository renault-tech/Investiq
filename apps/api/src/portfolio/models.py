"""Portfolio SQLAlchemy models."""
from decimal import Decimal

from sqlalchemy import Column, String, Numeric, Boolean, Text, ForeignKey, Date, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from src.database import Base


class Asset(Base):
    __tablename__ = "assets"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    ticker = Column(String(20), nullable=False, index=True)
    exchange = Column(String(20), nullable=True)
    name = Column(String(255), nullable=False)
    asset_type = Column(String(30), nullable=False)
    country = Column(String(10), nullable=True)
    sector = Column(String(100), nullable=True)
    currency = Column(String(10), nullable=False, default="BRL")
    last_price = Column(Numeric(18, 8), nullable=True)
    last_price_at = Column(TIMESTAMP(timezone=True), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    positions = relationship("PortfolioPosition", back_populates="asset")
    price_alerts = relationship("PriceAlert", back_populates="asset")


class Portfolio(Base):
    __tablename__ = "portfolios"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text(), nullable=True)
    currency = Column(String(10), nullable=False, default="BRL")
    is_default = Column(Boolean(), nullable=False, default=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    positions = relationship("PortfolioPosition", back_populates="portfolio", cascade="all, delete-orphan")


class BankAccount(Base):
    __tablename__ = "bank_accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    institution = Column(String(100), nullable=True)
    account_type = Column(String(20), nullable=False, default="checking")
    balance = Column(Numeric(18, 8), nullable=False, default=Decimal("0"))
    currency = Column(String(10), nullable=False, default="BRL")
    is_active = Column(Boolean(), nullable=False, default=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class PortfolioPosition(Base):
    __tablename__ = "portfolio_positions"
    __table_args__ = (
        UniqueConstraint("portfolio_id", "asset_id", "broker", name="uq_position_portfolio_asset_broker"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    portfolio_id = Column(UUID(as_uuid=True), ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    asset_id = Column(UUID(as_uuid=True), ForeignKey("assets.id", ondelete="RESTRICT"), nullable=False)
    broker = Column(String(100), nullable=True)
    quantity = Column(Numeric(18, 8), nullable=False, default=Decimal("0"))
    avg_cost = Column(Numeric(18, 8), nullable=False, default=Decimal("0"))
    total_invested = Column(Numeric(18, 8), nullable=False, default=Decimal("0"))
    target_weight = Column(Numeric(5, 4), nullable=True)
    target_value_brl = Column(Numeric(18, 8), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    portfolio = relationship("Portfolio", back_populates="positions")
    asset = relationship("Asset", back_populates="positions")
    transactions = relationship("InvestmentTransaction", back_populates="position", cascade="all, delete-orphan")


class InvestmentTransaction(Base):
    __tablename__ = "investment_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    position_id = Column(UUID(as_uuid=True), ForeignKey("portfolio_positions.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    transaction_type = Column(String(20), nullable=False)
    quantity = Column(Numeric(18, 8), nullable=False)
    unit_price = Column(Numeric(18, 8), nullable=False)
    fees = Column(Numeric(18, 8), nullable=False, default=Decimal("0"))
    fx_rate = Column(Numeric(18, 8), nullable=False, default=Decimal("1"))
    total_amount = Column(Numeric(18, 8), nullable=False)
    transaction_date = Column(TIMESTAMP(timezone=True), nullable=False, index=True)
    notes = Column(Text(), nullable=True)
    finance_transaction_id = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    position = relationship("PortfolioPosition", back_populates="transactions")


class PriceAlert(Base):
    __tablename__ = "price_alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    asset_id = Column(UUID(as_uuid=True), ForeignKey("assets.id", ondelete="CASCADE"), nullable=False, index=True)
    alert_type = Column(String(20), nullable=False)
    threshold = Column(Numeric(18, 8), nullable=False)
    is_active = Column(Boolean(), nullable=False, default=True)
    triggered_at = Column(TIMESTAMP(timezone=True), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    asset = relationship("Asset", back_populates="price_alerts")


class FxRate(Base):
    __tablename__ = "fx_rates"
    __table_args__ = (
        UniqueConstraint("from_currency", "to_currency", "date", name="uq_fx_rates_pair_date"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    from_currency = Column(String(10), nullable=False)
    to_currency = Column(String(10), nullable=False)
    rate = Column(Numeric(18, 8), nullable=False)
    date = Column(Date(), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
