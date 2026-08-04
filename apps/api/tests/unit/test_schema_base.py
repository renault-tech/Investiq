"""Unit tests for AppModel — the shared Pydantic base every API schema
inherits from so Decimal fields never serialize as "0E-8".

Plain str(Decimal("0.00000000")) is "0E-8" (Python's Decimal switches to
scientific notation for a zero with a deep enough scale), which is exactly
what every NUMERIC(18,8) column produces for a zero value. Pydantic's
default Decimal-to-JSON path is that same str(), so any response schema
that inherits straight from pydantic.BaseModel leaks "0E-8" into the API.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from decimal import Decimal
from typing import Optional

from src.shared.schema_base import AppModel


class _Money(AppModel):
    amount: Decimal
    maybe: Optional[Decimal] = None


def test_zero_decimal_serializes_as_fixed_point_not_scientific_notation():
    m = _Money(amount=Decimal("0.00000000"))
    assert m.model_dump_json() == '{"amount":"0.00000000","maybe":null}'


def test_db_roundtripped_zero_also_fixed_point():
    # Decimal('0E-8') is exactly what asyncpg/SQLAlchemy hands back for a
    # NUMERIC(18,8) zero — the actual shape seen in production, not just a
    # literal someone might type.
    m = _Money(amount=Decimal("0E-8"))
    assert m.model_dump(mode="json")["amount"] == "0.00000000"


def test_nonzero_decimal_unaffected():
    m = _Money(amount=Decimal("1234.50000000"))
    assert m.model_dump(mode="json")["amount"] == "1234.50000000"


def test_from_attributes_config_still_merges_with_the_shared_base():
    """model_config = {"from_attributes": True} on a subclass (the pattern
    used throughout portfolio/finance/cards schemas) must not wipe out the
    json_encoders set on AppModel — Pydantic v2 merges model_config across
    the MRO rather than the child fully replacing the parent's."""

    class Sub(AppModel):
        model_config = {"from_attributes": True}
        amount: Decimal

    assert Sub.model_config.get("from_attributes") is True
    assert Sub(amount=Decimal("0.00000000")).model_dump(mode="json")["amount"] == "0.00000000"
