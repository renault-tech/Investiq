"""Credit card / invoice Pydantic schemas."""
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import Field

from src.shared.schema_base import AppModel as BaseModel


class CardCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    brand: Optional[Literal["visa", "mastercard", "elo", "amex", "other"]] = None
    last4: Optional[str] = Field(None, pattern=r"^\d{4}$")
    credit_limit: Optional[Decimal] = Field(None, gt=0)
    closing_day: Optional[int] = Field(None, ge=1, le=31)
    due_day: Optional[int] = Field(None, ge=1, le=31)


class CardUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    brand: Optional[Literal["visa", "mastercard", "elo", "amex", "other"]] = None
    last4: Optional[str] = Field(None, pattern=r"^\d{4}$")
    credit_limit: Optional[Decimal] = Field(None, gt=0)
    closing_day: Optional[int] = Field(None, ge=1, le=31)
    due_day: Optional[int] = Field(None, ge=1, le=31)
    is_active: Optional[bool] = None


class CardResponse(BaseModel):
    id: uuid.UUID
    name: str
    brand: Optional[str]
    last4: Optional[str]
    credit_limit: Optional[Decimal]
    closing_day: Optional[int]
    due_day: Optional[int]
    is_active: bool

    model_config = {"from_attributes": True}


class InvoiceItemResponse(BaseModel):
    id: uuid.UUID
    description: str
    amount: Decimal
    purchase_date: Optional[date]
    installment_no: Optional[int]
    installment_total: Optional[int]
    suggested_category_id: Optional[uuid.UUID]
    category_id: Optional[uuid.UUID]
    financial_transaction_id: Optional[uuid.UUID]
    is_ignored: bool

    model_config = {"from_attributes": True}


class InvoiceItemUpdate(BaseModel):
    description: Optional[str] = Field(None, min_length=1, max_length=255)
    amount: Optional[Decimal] = Field(None, gt=0)
    purchase_date: Optional[date] = None
    category_id: Optional[uuid.UUID] = None
    is_ignored: Optional[bool] = None


class InvoiceResponse(BaseModel):
    id: uuid.UUID
    card_id: uuid.UUID
    reference_month: date
    due_date: Optional[date]
    status: str
    total_amount: Optional[Decimal]
    file_name: Optional[str]
    error_message: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class InvoiceDetailResponse(InvoiceResponse):
    items: list[InvoiceItemResponse]


class CategoryBreakdownSlice(BaseModel):
    category_id: Optional[uuid.UUID]
    category: str
    amount: Decimal
    delta_pct: Optional[Decimal] = None  # None = sem histórico suficiente pra comparar


class InvoiceTrendPoint(BaseModel):
    reference_month: date
    total_amount: Decimal


class InvoiceFinding(BaseModel):
    kind: Literal["duplicate", "category_spike", "uncategorized"]
    title: str
    description: str
    amount: Optional[Decimal] = None


class InvoiceAnalyticsResponse(BaseModel):
    invoice_id: uuid.UUID
    category_breakdown: list[CategoryBreakdownSlice]
    trend: list[InvoiceTrendPoint]
    avg_amount: Decimal
    top_items: list[InvoiceItemResponse]
    findings: list[InvoiceFinding]
