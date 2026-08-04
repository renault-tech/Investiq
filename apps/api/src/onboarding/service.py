"""Onboarding checklist status — derived from real data, not a separately
tracked "completed steps" table. A step is done the moment the user has
actually done the underlying thing; nothing to keep in sync."""
import uuid

from sqlalchemy import select, exists
from sqlalchemy.ext.asyncio import AsyncSession

from src.portfolio.models import Portfolio, PortfolioPosition, InvestmentTransaction
from src.finance.models import FinancialTransaction
from src.finance.goal_models import FinanceGoal


async def _exists(db: AsyncSession, model, user_id: uuid.UUID, *extra_clauses) -> bool:
    result = await db.execute(
        select(exists().where(model.user_id == user_id, *extra_clauses))
    )
    return bool(result.scalar())


async def get_onboarding_status(user_id: uuid.UUID, db: AsyncSession) -> dict:
    return {
        "has_portfolio": await _exists(db, Portfolio, user_id),
        "has_position": await _exists(db, PortfolioPosition, user_id),
        "has_transaction": await _exists(db, InvestmentTransaction, user_id),
        "has_finance_transaction": await _exists(
            db, FinancialTransaction, user_id, FinancialTransaction.deleted_at.is_(None)
        ),
        "has_goal": await _exists(db, FinanceGoal, user_id),
    }
