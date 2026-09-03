"""Portfolio Pydantic schemas."""
from decimal import Decimal
from typing import Optional
from datetime import datetime, date as dt_date
import uuid

from pydantic import Field

from src.shared.schema_base import AppModel as BaseModel


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
    holder: Optional[str] = Field(default=None, max_length=80)


class PortfolioUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    holder: Optional[str] = Field(None, max_length=80)


class PortfolioResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str]
    currency: str
    is_default: bool
    holder: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Position with live data
# ---------------------------------------------------------------------------

class PositionSummary(BaseModel):
    position_id: uuid.UUID
    asset_id: uuid.UUID
    ticker: str
    asset_name: str
    asset_type: str
    broker: Optional[str]
    quantity: Decimal
    avg_cost: Decimal
    currency: str
    current_price: Optional[Decimal]
    current_price_native: Optional[Decimal]
    market_value_brl: Decimal
    market_value_native: Decimal
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

class AllocationSlice(BaseModel):
    asset_type: str
    value: Decimal
    weight: Decimal   # 0.0-1.0 fraction of portfolio


class PortfolioSummaryResponse(BaseModel):
    portfolio_id: uuid.UUID
    portfolio_name: str
    total_invested_brl: Decimal
    total_market_value_brl: Decimal
    total_pnl_absolute: Decimal
    total_pnl_percent: Decimal
    xirr_percent: Optional[Decimal] = None
    positions: list[PositionSummary]
    rebalance_suggestions: list[dict]
    allocation_by_type: list[AllocationSlice] = []


class ConsolidatedPositionSummary(PositionSummary):
    """Mesmos campos de PositionSummary, com a carteira de origem anexada —
    uma posição de MSFT na carteira A e outra na carteira B viram duas
    linhas distintas aqui, nunca somadas numa só."""
    portfolio_id: uuid.UUID
    portfolio_name: str


class ConsolidatedSummaryResponse(BaseModel):
    """Mesma forma de PortfolioSummaryResponse, somando todas as carteiras
    do usuário — sem portfolio_id/portfolio_name (não é uma carteira) e sem
    rebalance_suggestions (a sugestão de rebalanceamento de cada posição é
    calculada contra o peso-alvo dentro da SUA carteira; misturar carteiras
    diferentes na mesma sugestão não faz sentido)."""
    total_invested_brl: Decimal
    total_market_value_brl: Decimal
    total_pnl_absolute: Decimal
    total_pnl_percent: Decimal
    xirr_percent: Optional[Decimal] = None
    positions: list[ConsolidatedPositionSummary]
    allocation_by_type: list[AllocationSlice] = []
    portfolio_count: int


# ---------------------------------------------------------------------------
# Look-through geográfico e setorial
# ---------------------------------------------------------------------------

class LookThroughBucket(BaseModel):
    label: str
    value_brl: Decimal
    weight: Decimal   # 0.0-1.0 fraction of portfolio


class PortfolioLookThroughResponse(BaseModel):
    portfolio_id: uuid.UUID
    total_market_value_brl: Decimal
    by_sector: list[LookThroughBucket]
    by_country: list[LookThroughBucket]
    by_asset_class: list[LookThroughBucket]
    # Fração da carteira cujo país foi de fato resolvido — para fundos, a
    # geografia é uma amostra das maiores posições, não a composição
    # completa, então isso mede o quanto dessa amostra é confiável.
    country_coverage: Decimal


# ---------------------------------------------------------------------------
# Performance series
# ---------------------------------------------------------------------------

class PerformancePoint(BaseModel):
    date: dt_date
    total_value: Decimal
    total_invested: Decimal


class BenchmarkPoint(BaseModel):
    """Cumulative % return since the start of the window, for chart overlay.

    cdi_pct/ibov_pct/nasdaq_pct/sp500_pct are null wherever the corresponding
    benchmark data wasn't available yet (e.g. before the first data point in
    range), never a fabricated zero.
    """
    date: dt_date
    portfolio_pct: Decimal
    cdi_pct: Optional[Decimal] = None
    ibov_pct: Optional[Decimal] = None
    nasdaq_pct: Optional[Decimal] = None
    sp500_pct: Optional[Decimal] = None


# ---------------------------------------------------------------------------
# Income (dividends)
# ---------------------------------------------------------------------------

class MonthlyIncomePoint(BaseModel):
    month: str  # "2026-07"
    amount: Decimal


class AssetIncomeSummary(BaseModel):
    ticker: str
    total_12m: Decimal
    yield_on_cost: Decimal


class PortfolioIncomeResponse(BaseModel):
    year: int
    total: Decimal
    monthly_series: list[MonthlyIncomePoint]
    by_asset: list[AssetIncomeSummary]


# ---------------------------------------------------------------------------
# Transaction
# ---------------------------------------------------------------------------

class TransactionCreate(BaseModel):
    position_id: uuid.UUID
    transaction_type: str = Field(..., pattern="^(buy|sell|dividend|split|bonus)$")
    quantity: Decimal = Field(..., gt=0)
    unit_price: Decimal = Field(..., gt=0)
    fees: Decimal = Field(default=Decimal("0"), ge=0)
    # Ausente = resolvido pela moeda do ativo no momento do lançamento (ver
    # service.record_transaction). O default 1 de antes tratava dólar como
    # real em silêncio no custo da posição.
    fx_rate: Optional[Decimal] = Field(default=None, gt=0)
    transaction_date: datetime
    notes: Optional[str] = None


class TransactionUpdate(BaseModel):
    transaction_type: Optional[str] = Field(None, pattern="^(buy|sell|dividend|split|bonus)$")
    quantity: Optional[Decimal] = Field(None, gt=0)
    unit_price: Optional[Decimal] = Field(None, gt=0)
    fees: Optional[Decimal] = Field(None, ge=0)
    fx_rate: Optional[Decimal] = Field(None, gt=0)
    transaction_date: Optional[datetime] = None
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
# Add Position
# ---------------------------------------------------------------------------

class AddPositionRequest(BaseModel):
    ticker: str = Field(..., min_length=1, max_length=20)
    broker: Optional[str] = Field(None, max_length=100)
    target_weight: Optional[Decimal] = Field(None, ge=0, le=1)
    # "stock" quando omitido preserva o comportamento anterior (todo ativo
    # novo virava genericamente "stock"). "cash" é reserva/caixa (cofrinho,
    # CDB de liquidez diária tratado como dinheiro) — não tem cotação de
    # mercado, então nem pede nem busca uma.
    asset_type: Optional[str] = Field(None, max_length=30)
    name: Optional[str] = Field(None, max_length=200)


class UpdatePositionRequest(BaseModel):
    """Só corretora e peso-alvo — quantidade e preço médio vêm das transações."""
    broker: Optional[str] = Field(None, max_length=100)
    target_weight: Optional[Decimal] = Field(None, ge=0, le=1)


class PositionResponse(BaseModel):
    id: uuid.UUID
    portfolio_id: uuid.UUID
    asset_id: uuid.UUID
    ticker: str
    broker: Optional[str]
    quantity: Decimal
    avg_cost: Decimal
    target_weight: Optional[Decimal]
    created_at: datetime

    model_config = {"from_attributes": True}


# Os schemas de conta bancária vivem em src/finance/schemas.py desde a
# migração 0011 — conta é um conceito de finanças, não de portfólio.

# ---------------------------------------------------------------------------
# Auditoria de cálculo
# ---------------------------------------------------------------------------

class AuditIssue(BaseModel):
    code: str
    message: str
    transaction_count: int


class AuditPosition(BaseModel):
    position_id: uuid.UUID
    ticker: str
    currency: str
    quantity: Decimal
    price_native: Decimal
    fx_rate: Decimal
    market_value_brl: Decimal
    cost_basis_brl: Decimal
    issues: list[AuditIssue]


class PortfolioAuditResponse(BaseModel):
    portfolio_id: uuid.UUID
    total_market_value_brl: Decimal
    total_cost_basis_brl: Decimal
    issue_count: int
    positions: list[AuditPosition]


class PortfolioRepairResponse(BaseModel):
    transactions_repaired: int
    positions_recalculated: int
    transactions_skipped_no_rate: int
    snapshots_cleared: int
