"""Finance Pydantic schemas — categories, transactions, monthly summary."""
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, Field


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
    transaction_date: datetime
    recurrence_rule: Optional[str] = Field(None, max_length=100)
    tags: list[str] = Field(default_factory=list)


class TransactionUpdate(BaseModel):
    transaction_type: Optional[Literal["income", "expense", "transfer"]] = None
    amount: Optional[Decimal] = Field(None, gt=0)
    description: Optional[str] = Field(None, max_length=255)
    notes: Optional[str] = None
    category_id: Optional[uuid.UUID] = None
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
    transaction_date: datetime
    is_recurring: bool
    recurrence_rule: Optional[str]
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
