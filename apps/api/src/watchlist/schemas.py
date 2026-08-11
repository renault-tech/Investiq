"""Watchlist Pydantic schemas."""
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import Field

from src.shared.schema_base import AppModel as BaseModel


class WatchlistAddRequest(BaseModel):
    ticker: str = Field(..., min_length=1, max_length=20)


class WatchlistItemResponse(BaseModel):
    id: uuid.UUID
    ticker: str
    name: str
    asset_type: str
    price: Optional[Decimal]
    change_pct: Optional[Decimal]
    currency: str
    created_at: datetime
