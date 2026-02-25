"""Pydantic schemas for user settings endpoints."""
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


class SettingsResponse(BaseModel):
    theme: str
    accent_color: str
    font_size_scale: str
    base_currency: str
    preferred_provider: str
    preferred_llm: str
    llm_model: Optional[str] = None
    notify_price_alerts: bool
    notify_email: bool
    # Key presence indicators — actual values are never returned
    has_claude_api_key: bool
    has_openai_api_key: bool
    has_gemini_api_key: bool
    has_alpha_vantage_key: bool
    has_brapi_key: bool
    has_polygon_key: bool
    updated_at: Optional[datetime] = None


class SettingsPatchRequest(BaseModel):
    """Partial update for non-sensitive settings (appearance, preferences)."""
    theme: Optional[str] = Field(default=None, pattern="^(dark|light)$")
    accent_color: Optional[str] = None
    font_size_scale: Optional[str] = None
    base_currency: Optional[str] = None
    preferred_provider: Optional[str] = Field(default=None, pattern="^(yahoo|brapi)$")
    preferred_llm: Optional[str] = Field(default=None, pattern="^(claude|openai|gemini)$")
    llm_model: Optional[str] = None
    notify_price_alerts: Optional[bool] = None
    notify_email: Optional[bool] = None


class ApiKeysUpdateRequest(BaseModel):
    """Update one or more API keys. Pass null to clear a key."""
    claude_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    alpha_vantage_key: Optional[str] = None
    brapi_key: Optional[str] = None
    polygon_key: Optional[str] = None
