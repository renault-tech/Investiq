"""Price alert Pydantic schemas."""
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, Field


class AlertCreate(BaseModel):
    ticker: str = Field(..., min_length=1, max_length=20)
    alert_type: Literal["price_above", "price_below"]
    threshold: Decimal = Field(..., gt=0)


class AlertResponse(BaseModel):
    id: uuid.UUID
    ticker: str
    alert_type: str
    threshold: Decimal
    is_active: bool
    triggered_at: Optional[datetime]
    created_at: datetime
