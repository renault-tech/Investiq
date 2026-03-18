"""Unit tests for portfolio service — add_position."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from decimal import Decimal
import uuid

from src.portfolio.service import add_position
from src.shared.exceptions import NotFoundError, ConflictError


def make_portfolio(user_id, portfolio_id=None):
    p = MagicMock()
    p.id = portfolio_id or uuid.uuid4()
    p.user_id = user_id
    return p


def make_asset(ticker):
    a = MagicMock()
    a.id = uuid.uuid4()
    a.ticker = ticker
    return a


@pytest.mark.asyncio
async def test_add_position_not_found_portfolio():
    """Raise NotFoundError when portfolio doesn't belong to user."""
    db = AsyncMock()
    db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None)))
    with pytest.raises(NotFoundError):
        await add_position(uuid.uuid4(), uuid.uuid4(), "PETR4", None, None, db)


@pytest.mark.asyncio
async def test_add_position_conflict_duplicate():
    """Raise ConflictError when position for ticker already exists in portfolio."""
    user_id = uuid.uuid4()
    portfolio_id = uuid.uuid4()
    db = AsyncMock()
    portfolio = make_portfolio(user_id, portfolio_id)
    asset = make_asset("PETR4")
    existing_position = MagicMock()

    # First call: portfolio found; second: asset found; third: position already exists
    db.execute = AsyncMock(side_effect=[
        MagicMock(scalar_one_or_none=MagicMock(return_value=portfolio)),
        MagicMock(scalar_one_or_none=MagicMock(return_value=asset)),
        MagicMock(scalar_one_or_none=MagicMock(return_value=existing_position)),
    ])
    with pytest.raises(ConflictError):
        await add_position(portfolio_id, user_id, "PETR4", None, None, db)
