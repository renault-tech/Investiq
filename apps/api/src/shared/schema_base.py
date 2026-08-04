"""Shared Pydantic base for all API schemas.

Plain str(Decimal) — Pydantic's default Decimal-to-JSON path — switches to
scientific notation for zero-valued Decimals with a deep enough scale: every
NUMERIC(18,8) column round-trips a zero as Decimal('0E-8'), and str() on
that renders the confusing "0E-8" in API responses instead of
"0.00000000". format(value, 'f') is fixed-point, never scientific notation
— the same fix already applied to CSV export in shared/csv_export.py,
generalized here so every schema gets it by inheriting from AppModel
instead of pydantic.BaseModel directly.
"""
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


def _format_decimal(value: Decimal) -> str:
    return format(value, "f")


class AppModel(BaseModel):
    model_config = ConfigDict(json_encoders={Decimal: _format_decimal})
