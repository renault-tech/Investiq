"""Business logic for the Finance module."""
import uuid
from decimal import Decimal
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, extract

from src.finance.models import FinanceCategory, FinancialTransaction
from src.finance.schemas import (
    CategoryCreate, TransactionCreate, TransactionUpdate,
    MonthlySummary, MonthlyBar, FinanceSummaryResponse, TransactionResponse,
)
from src.shared.exceptions import NotFoundError

# ─── Default categories seeded on first use ──────────────────────────────────

_DEFAULT_CATEGORIES = [
    ("Salário", "income", "#10B981", "briefcase"),
    ("Freelance", "income", "#34D399", "laptop"),
    ("Investimentos", "income", "#059669", "trending-up"),
    ("Outros (Receita)", "income", "#6EE7B7", "plus-circle"),
    ("Moradia", "expense", "#EF4444", "home"),
    ("Alimentação", "expense", "#F97316", "utensils"),
    ("Transporte", "expense", "#F59E0B", "car"),
    ("Saúde", "expense", "#EC4899", "heart"),
    ("Educação", "expense", "#8B5CF6", "book"),
    ("Lazer", "expense", "#06B6D4", "smile"),
    ("Assinaturas", "expense", "#6366F1", "repeat"),
    ("Outros (Despesa)", "expense", "#94A3B8", "more-horizontal"),
]


async def _ensure_defaults(user_id: uuid.UUID, db: AsyncSession) -> None:
    result = await db.execute(
        select(func.count()).where(FinanceCategory.user_id == user_id)
    )
    count = result.scalar_one()
    if count == 0:
        for name, cat_type, color, icon in _DEFAULT_CATEGORIES:
            db.add(FinanceCategory(
                user_id=user_id, name=name,
                category_type=cat_type, color=color, icon=icon,
            ))
        await db.flush()


# ─── Categories ──────────────────────────────────────────────────────────────

async def list_categories(user_id: uuid.UUID, db: AsyncSession) -> list[FinanceCategory]:
    await _ensure_defaults(user_id, db)
    await db.commit()
    result = await db.execute(
        select(FinanceCategory)
        .where(FinanceCategory.user_id == user_id, FinanceCategory.is_active == True)
        .order_by(FinanceCategory.category_type, FinanceCategory.name)
    )
    return list(result.scalars().all())


async def create_category(user_id: uuid.UUID, body: CategoryCreate, db: AsyncSession) -> FinanceCategory:
    cat = FinanceCategory(user_id=user_id, **body.model_dump())
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return cat


# ─── Transactions ─────────────────────────────────────────────────────────────

def _to_response(t: FinancialTransaction) -> dict:
    return {
        "id": t.id,
        "transaction_type": t.transaction_type,
        "amount": t.amount,
        "description": t.description,
        "notes": t.notes,
        "transaction_date": t.transaction_date,
        "category_id": t.category_id,
        "category_name": t.category.name if t.category else None,
        "category_color": t.category.color if t.category else None,
        "created_at": t.created_at,
    }


async def list_transactions(
    user_id: uuid.UUID, year: int, month: int, db: AsyncSession
) -> list[dict]:
    result = await db.execute(
        select(FinancialTransaction)
        .where(
            FinancialTransaction.user_id == user_id,
            FinancialTransaction.deleted_at == None,
            extract("year", FinancialTransaction.transaction_date) == year,
            extract("month", FinancialTransaction.transaction_date) == month,
        )
        .order_by(FinancialTransaction.transaction_date.desc())
    )
    rows = result.scalars().all()
    # eager-load category via selectin would be cleaner, but inline works for now
    for row in rows:
        if row.category_id:
            cat_res = await db.execute(
                select(FinanceCategory).where(FinanceCategory.id == row.category_id)
            )
            row.category = cat_res.scalar_one_or_none()
        else:
            row.category = None
    return [_to_response(r) for r in rows]


async def create_transaction(
    user_id: uuid.UUID, body: TransactionCreate, db: AsyncSession
) -> dict:
    t = FinancialTransaction(user_id=user_id, **body.model_dump())
    db.add(t)
    await db.commit()
    await db.refresh(t)
    if t.category_id:
        cat_res = await db.execute(select(FinanceCategory).where(FinanceCategory.id == t.category_id))
        t.category = cat_res.scalar_one_or_none()
    else:
        t.category = None
    return _to_response(t)


async def update_transaction(
    tx_id: uuid.UUID, user_id: uuid.UUID, body: TransactionUpdate, db: AsyncSession
) -> dict:
    result = await db.execute(
        select(FinancialTransaction).where(
            FinancialTransaction.id == tx_id,
            FinancialTransaction.user_id == user_id,
            FinancialTransaction.deleted_at == None,
        )
    )
    t = result.scalar_one_or_none()
    if not t:
        raise NotFoundError("Transaction not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(t, field, value)
    await db.commit()
    await db.refresh(t)
    if t.category_id:
        cat_res = await db.execute(select(FinanceCategory).where(FinanceCategory.id == t.category_id))
        t.category = cat_res.scalar_one_or_none()
    else:
        t.category = None
    return _to_response(t)


async def delete_transaction(tx_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> None:
    result = await db.execute(
        select(FinancialTransaction).where(
            FinancialTransaction.id == tx_id,
            FinancialTransaction.user_id == user_id,
            FinancialTransaction.deleted_at == None,
        )
    )
    t = result.scalar_one_or_none()
    if not t:
        raise NotFoundError("Transaction not found")
    t.deleted_at = datetime.now(timezone.utc)
    await db.commit()


# ─── Summary ─────────────────────────────────────────────────────────────────

async def get_summary(user_id: uuid.UUID, year: int, month: int, db: AsyncSession) -> FinanceSummaryResponse:
    # Current month totals
    def month_filter(y: int, m: int):
        return and_(
            FinancialTransaction.user_id == user_id,
            FinancialTransaction.deleted_at == None,
            extract("year", FinancialTransaction.transaction_date) == y,
            extract("month", FinancialTransaction.transaction_date) == m,
        )

    async def month_totals(y: int, m: int):
        res = await db.execute(
            select(
                FinancialTransaction.transaction_type,
                func.sum(FinancialTransaction.amount).label("total"),
            )
            .where(month_filter(y, m))
            .group_by(FinancialTransaction.transaction_type)
        )
        rows = res.fetchall()
        income = Decimal(0)
        expense = Decimal(0)
        for r in rows:
            if r.transaction_type == "income":
                income = r.total or Decimal(0)
            elif r.transaction_type == "expense":
                expense = r.total or Decimal(0)
        return income, expense

    income, expense = await month_totals(year, month)
    balance = income - expense
    savings_rate = (balance / income * 100).quantize(Decimal("0.01")) if income > 0 else None

    # Last 6 months bars
    bars: list[MonthlyBar] = []
    y, m = year, month
    for _ in range(6):
        inc, exp = await month_totals(y, m)
        bars.insert(0, MonthlyBar(year=y, month=m, income=inc, expense=exp))
        m -= 1
        if m == 0:
            m = 12
            y -= 1

    return FinanceSummaryResponse(
        current=MonthlySummary(
            year=year, month=month,
            total_income=income, total_expense=expense,
            balance=balance, savings_rate=savings_rate,
        ),
        last_6_months=bars,
    )
