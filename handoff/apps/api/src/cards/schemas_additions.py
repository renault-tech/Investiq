# Adicionar ao final de apps/api/src/cards/schemas.py (mesmo arquivo, não um novo).

from typing import Literal


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
