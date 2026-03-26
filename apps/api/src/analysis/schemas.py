import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator

class SaveAnalysisRequest(BaseModel):
    portfolio_id: uuid.UUID
    raw_text: str
    sections: dict[str, str]           
    provider: Optional[str] = None
    model: Optional[str] = None

    @field_validator("sections")
    @classmethod
    def validate_sections_keys(cls, v: dict) -> dict:
        required = {"context", "summary", "composition", "risks", "opportunities", "recommendations"}
        missing = required - set(v.keys())
        if missing:
            raise ValueError(f"sections faltando chaves: {missing}")
        return v


class AnalysisMessageSchema(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    created_at: datetime
    model_config = {"from_attributes": True}


class AnalysisListItem(BaseModel):
    """Retornado pelo service como dict (nao ORM direto) para incluir summary_snippet computado."""
    id: uuid.UUID
    created_at: datetime
    provider: Optional[str]
    model: Optional[str]
    summary_snippet: str               # computado no service: sections["summary"][:120]


class AnalysisDetail(BaseModel):
    id: uuid.UUID
    portfolio_id: uuid.UUID
    raw_text: str
    sections: dict[str, str]
    provider: Optional[str]
    model: Optional[str]
    created_at: datetime
    messages: list[AnalysisMessageSchema]
    model_config = {"from_attributes": True}


class AddMessageRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=4000)


class RecentContextResponse(BaseModel):
    raw_texts: list[str]
