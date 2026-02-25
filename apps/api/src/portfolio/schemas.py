"""Portfolio Pydantic schemas."""
from decimal import Decimal
from typing import Optional
from datetime import datetime
import uuid

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Asset
# ---------------------------------------------------------------------------

class AssetResponse(BaseModel):
    id: uuid.UUID
    ticker: str
    exchange: Optional[str]
    name: str
    asset_type: str
    currency: str
    last_price: Optional[Decimal]
    last_price_at: Optional[datetime]

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Portfolio
# ---------------------------------------------------------------------------

class PortfolioCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    currency: str = Field(default="BRL", max_length=10)


class PortfolioResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str]
    currency: str
    is_default: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Position with live data
# ---------------------------------------------------------------------------

class PositionSummary(BaseModel):
    asset_id: uuid.UUID
    ticker: str
    asset_name: str
    asset_type: str
    broker: Optional[str]
    quantity: Decimal
    avg_cost: Decimal
    current_price: Optional[Decimal]
    market_value_brl: Decimal
    cost_basis_brl: Decimal
    pnl_absolute: Decimal
    pnl_percent: Decimal
    weight: Decimal   # 0.0-1.0 fraction of portfolio
    target_weight: Optional[Decimal]
    rebalance_action: Optional[str]
    rebalance_delta_units: Optional[Decimal]


# ---------------------------------------------------------------------------
# Portfolio summary
# ---------------------------------------------------------------------------

class PortfolioSummaryResponse(BaseModel):
    portfolio_id: uuid.UUID
    portfolio_name: str
    total_invested_brl: Decimal
    total_market_value_brl: Decimal
    total_pnl_absolute: Decimal
    total_pnl_percent: Decimal
    positions: list[PositionSummary]
    rebalance_suggestions: list[dict]


# ---------------------------------------------------------------------------
# Transaction
# ---------------------------------------------------------------------------

class TransactionCreate(BaseModel):
    position_id: uuid.UUID
    transaction_type: str = Field(..., pattern="^(buy|sell|dividend|split|bonus)$")
    quantity: Decimal = Field(..., gt=0)
    unit_price: Decimal = Field(..., gt=0)
    fees: Decimal = Field(default=Decimal("0"), ge=0)
    fx_rate: Decimal = Field(default=Decimal("1"), gt=0)
    transaction_date: datetime
    notes: Optional[str] = None


class TransactionResponse(BaseModel):
    id: uuid.UUID
    position_id: uuid.UUID
    transaction_type: str
    quantity: Decimal
    unit_price: Decimal
    fees: Decimal
    fx_rate: Decimal
    total_amount: Decimal
    transaction_date: datetime
    notes: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Bank Account
# ---------------------------------------------------------------------------

class BankAccountCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    institution: Optional[str] = None
    account_type: str = Field(default="checking", pattern="^(checking|savings|investment|broker)$")
    balance: Decimal = Field(default=Decimal("0"), ge=0)
    currency: str = Field(default="BRL", max_length=10)


class BankAccountResponse(BaseModel):
    id: uuid.UUID
    name: str
    institution: Optional[str]
    account_type: str
    balance: Decimal
    currency: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}