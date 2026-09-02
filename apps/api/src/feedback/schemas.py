"""Feedback de usuário — schemas."""
import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import Field

from src.shared.schema_base import AppModel as BaseModel


class FeedbackCreate(BaseModel):
    category: Literal["bug", "idea", "other"] = "other"
    message: str = Field(..., min_length=3, max_length=4000)
    page_path: Optional[str] = Field(None, max_length=200)


class FeedbackResponse(BaseModel):
    id: uuid.UUID
    category: str
    message: str
    page_path: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}
