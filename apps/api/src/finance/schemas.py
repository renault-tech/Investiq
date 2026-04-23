"""Pydantic schemas for the Finance module."""
import uuid
from decimal import Decimal
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


# ─── Category ────────────────────────────────────────────────────────────────

class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    category_type: str = Field(..., pattern="^(income|expense)$")
    color: Optional[str] = Field(default=None, pattern="^#[0-9A-Fa-f]{6}$")
    icon: Optional[str] = None


class CategoryResponse(BaseModel):
    id: uuid.UUID
    name: str
    category_type: str
    color: Optional[str]
    icon: Optional[str]
    is_active: bool
    model_config = {"from_attributes": True}


# ─── Transaction ─────────────────────────────────────────────────────────────

class TransactionCreate(BaseModel):
    transaction_type: str = Field(..., pattern="^(income|expense|transfer)$")
    amount: Decimal = Field(..., gt=0)
    description: str = Field(..., min_length=1, max_length=255)
    category_id: Optional[uuid.UUID] = None
    transaction_date: datetime
    notes: Optional[str] = None


class TransactionUpdate(BaseModel):
    transaction_type: Optional[str] = Field(default=None, pattern="^(income|expense|transfer)$")
    amount: Optional[Decimal] = Field(default=None, gt=0)
    description: Optional[str] = Field(default=None, min_length=1, max_length=255)
    category_id: Optional[uuid.UUID] = None
    transaction_date: Optional[datetime] = None
    notes: Optional[str] = None


class TransactionResponse(BaseModel):
    id: uuid.UUID
    transaction_type: str
    amount: Decimal
    description: str
    notes: Optional[str]
    transaction_date: datetime
    category_id: Optional[uuid.UUID]
    category_name: Optional[str]
    category_color: Optional[str]
    created_at: datetime
    model_config = {"from_attributes": True}


# ─── Summary ─────────────────────────────────────────────────────────────────

class MonthlySummary(BaseModel):
    year: int
    month: int
    total_income: Decimal
    total_expense: Decimal
    balance: Decimal
    savings_rate: Optional[Decimal]  # (income - expense) / income * 100


class MonthlyBar(BaseModel):
    year: int
    month: int
    income: Decimal
    expense: Decimal


class FinanceSummaryResponse(BaseModel):
    current: MonthlySummary
    last_6_months: list[MonthlyBar]
