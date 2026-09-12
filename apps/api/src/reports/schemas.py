"""Pydantic schemas for the generated-reports history."""
import uuid
from datetime import datetime
from typing import Any

from src.shared.schema_base import AppModel as BaseModel


class GeneratedReportResponse(BaseModel):
    id: uuid.UUID
    report_type: str
    format: str
    params: dict[str, Any]
    file_name: str
    file_size: int
    created_at: datetime

    model_config = {"from_attributes": True}
