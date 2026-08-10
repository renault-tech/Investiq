"""Finance Pydantic schemas — categories, transactions, monthly summary."""
import uuid
from datetime import datetime, date as dt_date
from decimal import Decimal
from typing import Literal, Optional

from pydantic import Field

from src.shared.schema_base import AppModel as BaseModel


# ---------------------------------------------------------------------------
# Categories
# ---------------------------------------------------------------------------

class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    category_type: Literal["income", "expense"]
    color: Optional[str] = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")
    icon: Optional[str] = Field(None, max_length=50)


class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    color: Optional[str] = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")
    icon: Optional[str] = Field(None, max_length=50)
    is_active: Optional[bool] = None


class CategoryResponse(BaseModel):
    id: uuid.UUID
    name: str
    category_type: str
    color: Optional[str]
    icon: Optional[str]
    is_active: bool

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Transactions
# ---------------------------------------------------------------------------

class TransactionCreate(BaseModel):
    transaction_type: Literal["income", "expense", "transfer"]
    amount: Decimal = Field(..., gt=0)
    description: Optional[str] = Field(None, max_length=255)
    notes: Optional[str] = None
    category_id: Optional[uuid.UUID] = None
    bank_account_id: Optional[uuid.UUID] = None
    to_bank_account_id: Optional[uuid.UUID] = None   # obrigatório quando type='transfer'
    transaction_date: datetime
    recurrence_rule: Optional[str] = Field(None, max_length=100)
    # Parcelamento: N>1 materializa N lançamentos mensais a partir da data.
    # `amount` é o total da compra, não o valor da parcela.
    installments: int = Field(default=1, ge=1, le=120)
    tags: list[str] = Field(default_factory=list)


class TransactionUpdate(BaseModel):
    transaction_type: Optional[Literal["income", "expense", "transfer"]] = None
    amount: Optional[Decimal] = Field(None, gt=0)
    description: Optional[str] = Field(None, max_length=255)
    notes: Optional[str] = None
    category_id: Optional[uuid.UUID] = None
    bank_account_id: Optional[uuid.UUID] = None
    to_bank_account_id: Optional[uuid.UUID] = None
    transaction_date: Optional[datetime] = None
    recurrence_rule: Optional[str] = Field(None, max_length=100)
    tags: Optional[list[str]] = None


class TransactionResponse(BaseModel):
    id: str                      # UUID, ou "{uuid}:{iso-date}" para ocorrência virtual
    transaction_type: str
    amount: Decimal
    currency: str
    description: Optional[str]
    notes: Optional[str]
    category_id: Optional[uuid.UUID]
    category_name: Optional[str]
    category_color: Optional[str]
    bank_account_id: Optional[uuid.UUID] = None
    bank_account_name: Optional[str] = None
    to_bank_account_id: Optional[uuid.UUID] = None
    to_bank_account_name: Optional[str] = None
    transaction_date: datetime
    is_recurring: bool
    recurrence_rule: Optional[str]
    installment_no: Optional[int] = None
    installment_total: Optional[int] = None
    source: str = "manual"
    is_virtual: bool = False     # ocorrência projetada de uma recorrência (não persiste)
    tags: list[str] = []


class TransactionListResponse(BaseModel):
    items: list[TransactionResponse]
    total: int
    page: int
    per_page: int


# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

class CategorySummary(BaseModel):
    category_id: Optional[uuid.UUID]
    category_name: str
    category_color: Optional[str]
    value: Decimal
    pct: Decimal


class MonthlyFlowPoint(BaseModel):
    month: str                   # "2026-07"
    income: Decimal
    expense: Decimal


class FinanceSummaryResponse(BaseModel):
    month: str
    income: Decimal
    expense: Decimal
    net: Decimal
    income_prev_pct: Optional[Decimal]    # variação vs mês anterior (fração)
    expense_prev_pct: Optional[Decimal]
    by_category: list[CategorySummary]    # despesas do mês por categoria
    monthly_series: list[MonthlyFlowPoint]  # últimos 12 meses


# ---------------------------------------------------------------------------
# Budgets
# ---------------------------------------------------------------------------

class BudgetUpsert(BaseModel):
    category_id: uuid.UUID
    amount: Decimal = Field(..., gt=0)


class BudgetResponse(BaseModel):
    id: uuid.UUID
    category_id: uuid.UUID
    category_name: str
    category_color: Optional[str]
    amount: Decimal
    period: str
    spent: Decimal   # gasto no mês corrente na categoria
    pct_used: Decimal  # spent / amount (fração; pode passar de 1)


# ---------------------------------------------------------------------------
# Savings goals
# ---------------------------------------------------------------------------

class GoalCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    target_amount: Decimal = Field(..., gt=0)
    target_date: Optional[dt_date] = None
    color: Optional[str] = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")
    icon: Optional[str] = Field(None, max_length=50)


class GoalUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    target_amount: Optional[Decimal] = Field(None, gt=0)
    target_date: Optional[dt_date] = None
    color: Optional[str] = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")
    icon: Optional[str] = Field(None, max_length=50)
    is_archived: Optional[bool] = None


class GoalContributeRequest(BaseModel):
    amount: Decimal = Field(..., description="Positivo para aportar, negativo para retirar")
    note: Optional[str] = Field(None, max_length=255)


class GoalContributionResponse(BaseModel):
    id: uuid.UUID
    amount: Decimal
    note: Optional[str]
    contributed_at: datetime


class GoalResponse(BaseModel):
    id: uuid.UUID
    name: str
    target_amount: Decimal
    current_amount: Decimal
    pct_complete: Decimal  # current_amount / target_amount (fração; capada em 1)
    target_date: Optional[dt_date]
    color: Optional[str]
    icon: Optional[str]
    is_archived: bool
    is_complete: bool
    created_at: datetime


# ---------------------------------------------------------------------------
# Accounts
# ---------------------------------------------------------------------------

_ACCOUNT_TYPE = Literal["checking", "savings", "cash", "investment", "other"]


class AccountCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    account_type: _ACCOUNT_TYPE = "checking"
    institution: Optional[str] = Field(None, max_length=100)
    holder: Optional[str] = Field(None, max_length=80)
    opening_balance: Decimal = Decimal("0")
    currency: str = Field(default="BRL", max_length=10)
    color: Optional[str] = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")
    icon: Optional[str] = Field(None, max_length=50)
    include_in_total: bool = True
    portfolio_id: Optional[uuid.UUID] = None


class AccountUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    account_type: Optional[_ACCOUNT_TYPE] = None
    institution: Optional[str] = Field(None, max_length=100)
    holder: Optional[str] = Field(None, max_length=80)
    opening_balance: Optional[Decimal] = None
    color: Optional[str] = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")
    icon: Optional[str] = Field(None, max_length=50)
    include_in_total: Optional[bool] = None
    portfolio_id: Optional[uuid.UUID] = None
    is_active: Optional[bool] = None


class AccountResponse(BaseModel):
    id: uuid.UUID
    name: str
    account_type: str
    institution: Optional[str]
    holder: Optional[str]
    opening_balance: Decimal
    balance: Decimal          # derivado: opening_balance +/- lançamentos até hoje
    currency: str
    color: Optional[str]
    icon: Optional[str]
    include_in_total: bool
    portfolio_id: Optional[uuid.UUID]
    is_active: bool


# ---------------------------------------------------------------------------
# Statement import (OFX/CSV)
# ---------------------------------------------------------------------------

class ImportRowResponse(BaseModel):
    id: uuid.UUID
    transaction_date: datetime
    amount: Decimal
    transaction_type: str
    description: str
    external_id: Optional[str]
    category_id: Optional[uuid.UUID]
    category_name: Optional[str] = None
    is_duplicate: bool
    duplicate_transaction_id: Optional[uuid.UUID]
    is_selected: bool


class ImportBatchResponse(BaseModel):
    id: uuid.UUID
    bank_account_id: Optional[uuid.UUID]
    file_name: str
    file_type: str
    status: str
    rows: list[ImportRowResponse]


class ImportRowUpdate(BaseModel):
    category_id: Optional[uuid.UUID] = None
    is_selected: Optional[bool] = None


class ImportConfirmResponse(BaseModel):
    created: int
    skipped: int


# ---------------------------------------------------------------------------
# Cash-flow forecast
# ---------------------------------------------------------------------------

class ForecastMonth(BaseModel):
    month: str                       # "2026-09"
    committed_income: Decimal        # já aconteceu ou está agendado (recorrência, parcela, fatura aberta)
    committed_expense: Decimal
    estimated_income: Decimal        # mediana de 6 meses, só para categorias sem cobertura conhecida
    estimated_expense: Decimal
    balance_committed: Decimal       # saldo acumulado só com o que é certo
    balance_realistic: Decimal       # saldo acumulado com o certo + a estimativa


class ForecastResponse(BaseModel):
    current_balance: Decimal
    months: list[ForecastMonth]
    negative_from: Optional[str]     # primeiro mês em que balance_realistic fica negativo


# ---------------------------------------------------------------------------
# Advanced analytics
# ---------------------------------------------------------------------------

class AnalyticsSavingsPoint(BaseModel):
    month: str
    income: Decimal
    expense: Decimal
    savings_rate: Optional[Decimal]   # (receita-despesa)/receita — None quando receita é 0


class AnalyticsCategoryTrend(BaseModel):
    category_id: Optional[uuid.UUID]
    category_name: str
    category_color: Optional[str]
    current_amount: Decimal
    baseline_median: Decimal
    pct_change: Optional[Decimal]     # None quando não há linha de base (categoria nova)
    direction: str                    # "up" | "down" | "stable"


class AnalyticsMatrixRow(BaseModel):
    category_id: Optional[uuid.UUID]
    category_name: str
    category_color: Optional[str]
    values: list[Decimal]             # alinhado a AnalyticsResponse.months


class AnalyticsResponse(BaseModel):
    months: list[str]                 # eixo comum da série e da matriz
    burn_rate: Decimal                # despesa média dos últimos 3 meses fechados
    savings_series: list[AnalyticsSavingsPoint]
    runway_months: Optional[Decimal]  # saldo consolidado / burn_rate — None se burn_rate é 0
    category_trends: list[AnalyticsCategoryTrend]
    category_matrix: list[AnalyticsMatrixRow]
