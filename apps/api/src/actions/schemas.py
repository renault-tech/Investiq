"""Central de Ações — schemas (novo módulo)."""
import uuid
from decimal import Decimal
from typing import Literal, Optional

from src.shared.schema_base import AppModel as BaseModel


class ActionItem(BaseModel):
    id: str  # id sintético: "tx:<uuid>" ou "invoice:<uuid>" — não é uma linha de tabela própria
    kind: Literal["bill_due", "bill_overdue", "invoice_review", "invoice_uncategorized"]
    title: str
    description: str
    amount: Optional[Decimal] = None
    due_date: Optional[str] = None  # ISO date, quando aplicável
    href: str  # rota do front pra resolver a pendência


class ActionCenterResponse(BaseModel):
    items: list[ActionItem]
    total_amount: Decimal  # soma do que está pendente (fatura a vencer + vencida)
