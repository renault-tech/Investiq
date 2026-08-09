"""Finance business logic — categories (with PT-BR seed), transactions with
soft-delete and virtual recurrence expansion, monthly summary.

Recurrence design (v1): a recurring transaction row is the *template* (first
occurrence). Later occurrences are expanded on read via dateutil.rrule as
virtual items (id "{uuid}:{date}") — nothing is materialized, so there is no
dedup problem. Editing/deleting the template affects the whole series.
"""
import json
import uuid
import logging
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

from dateutil.rrule import rrulestr
from sqlalchemy import select, or_, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from sqlalchemy.dialects.postgresql import insert as pg_insert

from src.finance.models import FinanceCategory, FinancialTransaction
from src.finance.budget_models import FinanceBudget
from src.finance.goal_models import FinanceGoal, FinanceGoalContribution
from src.shared.exceptions import NotFoundError, ConflictError, ValidationError

logger = logging.getLogger(__name__)

_ZERO = Decimal("0")
_ONE = Decimal("1")

DEFAULT_CATEGORIES: list[tuple[str, str, str, str]] = [
    # (name, type, color, icon)
    ("Alimentação", "expense", "#D97706", "utensils"),
    ("Moradia", "expense", "#2563EB", "home"),
    ("Transporte", "expense", "#0891B2", "car"),
    ("Saúde", "expense", "#DB2777", "heart-pulse"),
    ("Educação", "expense", "#7C3AED", "graduation-cap"),
    ("Lazer", "expense", "#059669", "gamepad-2"),
    ("Assinaturas", "expense", "#64748B", "repeat"),
    ("Outros", "expense", "#94A3B8", "circle-ellipsis"),
    ("Salário", "income", "#059669", "banknote"),
    ("Rendimentos", "income", "#2563EB", "trending-up"),
    ("Outros", "income", "#94A3B8", "circle-ellipsis"),
]


# ---------------------------------------------------------------------------
# Categories
# ---------------------------------------------------------------------------

async def ensure_default_categories(user_id: uuid.UUID, db: AsyncSession) -> None:
    """Seed default PT-BR categories on the user's first access (idempotent)."""
    result = await db.execute(
        select(sa_func.count(FinanceCategory.id)).where(FinanceCategory.user_id == user_id)
    )
    if (result.scalar() or 0) > 0:
        return
    for name, cat_type, color, icon in DEFAULT_CATEGORIES:
        db.add(FinanceCategory(
            user_id=user_id, name=name, category_type=cat_type, color=color, icon=icon,
        ))
    await db.commit()


async def list_categories(user_id: uuid.UUID, db: AsyncSession) -> list[FinanceCategory]:
    await ensure_default_categories(user_id, db)
    result = await db.execute(
        select(FinanceCategory)
        .where(FinanceCategory.user_id == user_id)
        .order_by(FinanceCategory.category_type, FinanceCategory.name)
    )
    return list(result.scalars().all())


async def create_category(
    user_id: uuid.UUID, name: str, category_type: str,
    color: Optional[str], icon: Optional[str], db: AsyncSession,
) -> FinanceCategory:
    existing = await db.execute(
        select(FinanceCategory).where(
            FinanceCategory.user_id == user_id,
            FinanceCategory.name == name,
            FinanceCategory.category_type == category_type,
        )
    )
    if existing.scalar_one_or_none():
        raise ConflictError(f"Categoria '{name}' já existe")
    category = FinanceCategory(
        user_id=user_id, name=name, category_type=category_type, color=color, icon=icon,
    )
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return category


async def _get_category(category_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> FinanceCategory:
    result = await db.execute(
        select(FinanceCategory).where(
            FinanceCategory.id == category_id, FinanceCategory.user_id == user_id
        )
    )
    category = result.scalar_one_or_none()
    if not category:
        raise NotFoundError("Categoria não encontrada")
    return category


async def update_category(
    category_id: uuid.UUID, user_id: uuid.UUID, updates: dict, db: AsyncSession,
) -> FinanceCategory:
    category = await _get_category(category_id, user_id, db)
    for field, value in updates.items():
        if value is not None:
            setattr(category, field, value)
    await db.commit()
    await db.refresh(category)
    return category


async def delete_category(category_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> None:
    """Deactivate a category (transactions keep pointing to it)."""
    category = await _get_category(category_id, user_id, db)
    category.is_active = False
    await db.commit()


# ---------------------------------------------------------------------------
# Transactions
# ---------------------------------------------------------------------------

def _parse_tags(raw: Optional[str]) -> list[str]:
    if not raw:
        return []
    try:
        data = json.loads(raw)
        return [str(t) for t in data] if isinstance(data, list) else []
    except (ValueError, TypeError):
        return []


def _txn_to_dict(txn: FinancialTransaction, *, virtual_date: Optional[datetime] = None) -> dict:
    return {
        "id": f"{txn.id}:{virtual_date.date().isoformat()}" if virtual_date else str(txn.id),
        "transaction_type": txn.transaction_type,
        "amount": txn.amount,
        "currency": txn.currency,
        "description": txn.description,
        "notes": txn.notes,
        "category_id": txn.category_id,
        "category_name": txn.category.name if txn.category else None,
        "category_color": txn.category.color if txn.category else None,
        "transaction_date": virtual_date or txn.transaction_date,
        "is_recurring": txn.is_recurring,
        "recurrence_rule": txn.recurrence_rule,
        "is_virtual": virtual_date is not None,
        "tags": _parse_tags(txn.tags),
    }


def expand_recurring(
    txn: FinancialTransaction,
    window_start: datetime,
    window_end: datetime,
    max_occurrences: int = 120,
) -> list[datetime]:
    """Occurrence datetimes of a recurring template inside [start, end], beyond
    the template's own date (which is a real row already)."""
    if not txn.recurrence_rule:
        return []
    base = txn.transaction_date
    if base.tzinfo is None:
        base = base.replace(tzinfo=timezone.utc)
    try:
        rule = rrulestr(txn.recurrence_rule, dtstart=base)
    except (ValueError, TypeError) as exc:
        logger.warning("Invalid RRULE on transaction %s: %s", txn.id, exc)
        return []
    occurrences = []
    for occurrence in rule:
        if occurrence <= base:
            continue
        if occurrence > window_end:
            break
        if occurrence >= window_start:
            occurrences.append(occurrence)
        if len(occurrences) >= max_occurrences:
            break
    return occurrences


async def list_transactions(
    user_id: uuid.UUID,
    db: AsyncSession,
    *,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    category_id: Optional[uuid.UUID] = None,
    transaction_type: Optional[str] = None,
    search: Optional[str] = None,
    tag: Optional[str] = None,
    page: int = 1,
    per_page: int = 50,
) -> dict:
    """Filtered listing; expands recurring templates virtually inside the window."""
    query = (
        select(FinancialTransaction)
        .options(selectinload(FinancialTransaction.category))
        .where(
            FinancialTransaction.user_id == user_id,
            FinancialTransaction.deleted_at.is_(None),
        )
    )
    if category_id:
        query = query.where(FinancialTransaction.category_id == category_id)
    if transaction_type:
        query = query.where(FinancialTransaction.transaction_type == transaction_type)
    if search:
        query = query.where(FinancialTransaction.description.ilike(f"%{search}%"))
    # Bound at the SQL level too (ix_financial_transactions_active covers
    # user_id+transaction_date) instead of always pulling the user's whole
    # history — a recurring template's own transaction_date can predate the
    # window and still be the source of occurrences inside it, so it's kept
    # regardless of date_from as long as it started before date_to.
    if date_to is not None:
        query = query.where(FinancialTransaction.transaction_date <= date_to)
    if date_from is not None:
        query = query.where(
            or_(
                FinancialTransaction.transaction_date >= date_from,
                FinancialTransaction.is_recurring.is_(True),
            )
        )

    result = await db.execute(query.order_by(FinancialTransaction.transaction_date.desc()))
    rows = list(result.scalars().all())

    items: list[dict] = []
    for txn in rows:
        base_in_window = (
            (date_from is None or txn.transaction_date >= date_from)
            and (date_to is None or txn.transaction_date <= date_to)
        )
        if base_in_window:
            items.append(_txn_to_dict(txn))
        if txn.is_recurring and txn.recurrence_rule and date_to is not None:
            window_start = date_from or txn.transaction_date
            for occurrence in expand_recurring(txn, window_start, date_to):
                items.append(_txn_to_dict(txn, virtual_date=occurrence))

    if tag:
        items = [item for item in items if tag in item["tags"]]

    items.sort(key=lambda item: item["transaction_date"], reverse=True)
    total = len(items)
    start = (page - 1) * per_page
    return {
        "items": items[start:start + per_page],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


async def create_transaction(user_id: uuid.UUID, data: dict, db: AsyncSession) -> dict:
    if data.get("category_id"):
        await _get_category(data["category_id"], user_id, db)
    txn = FinancialTransaction(
        user_id=user_id,
        transaction_type=data["transaction_type"],
        amount=data["amount"],
        description=data.get("description"),
        notes=data.get("notes"),
        category_id=data.get("category_id"),
        bank_account_id=data.get("bank_account_id"),
        transaction_date=data["transaction_date"],
        is_recurring=bool(data.get("recurrence_rule")),
        recurrence_rule=data.get("recurrence_rule"),
        tags=json.dumps(data.get("tags") or []),
    )
    db.add(txn)
    await db.commit()
    await db.refresh(txn, attribute_names=["category"])

    if txn.transaction_type == "expense" and txn.category_id:
        await _notify_if_budget_just_exceeded(user_id, txn.category_id, txn.amount, txn.transaction_date, db)

    return _txn_to_dict(txn)


async def _get_transaction(txn_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> FinancialTransaction:
    result = await db.execute(
        select(FinancialTransaction)
        .options(selectinload(FinancialTransaction.category))
        .where(
            FinancialTransaction.id == txn_id,
            FinancialTransaction.user_id == user_id,
            FinancialTransaction.deleted_at.is_(None),
        )
    )
    txn = result.scalar_one_or_none()
    if not txn:
        raise NotFoundError("Transação não encontrada")
    return txn


async def update_transaction(txn_id: uuid.UUID, user_id: uuid.UUID, updates: dict, db: AsyncSession) -> dict:
    txn = await _get_transaction(txn_id, user_id, db)
    if updates.get("category_id"):
        await _get_category(updates["category_id"], user_id, db)
    for field, value in updates.items():
        if value is None:
            continue
        if field == "tags":
            txn.tags = json.dumps(value)
        elif field == "recurrence_rule":
            txn.recurrence_rule = value
            txn.is_recurring = True
        else:
            setattr(txn, field, value)
    await db.commit()
    await db.refresh(txn, attribute_names=["category"])
    return _txn_to_dict(txn)


async def delete_transaction(txn_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> None:
    """Soft-delete (sets deleted_at; recurring template deletion ends the series)."""
    txn = await _get_transaction(txn_id, user_id, db)
    txn.deleted_at = datetime.now(timezone.utc)
    await db.commit()


# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

def _month_bounds(month: str) -> tuple[datetime, datetime]:
    year, mon = int(month[:4]), int(month[5:7])
    start = datetime(year, mon, 1, tzinfo=timezone.utc)
    end = datetime(year + 1, 1, 1, tzinfo=timezone.utc) if mon == 12 else datetime(year, mon + 1, 1, tzinfo=timezone.utc)
    return start, end - timedelta(microseconds=1)


async def get_summary(user_id: uuid.UUID, month: str, db: AsyncSession) -> dict:
    """Monthly totals + expenses by category + 12-month flow, recurrences included."""
    start, end = _month_bounds(month)
    series_start = (start - timedelta(days=365)).replace(day=1)

    listing = await list_transactions(
        user_id, db, date_from=series_start, date_to=end, per_page=100_000,
    )
    items = listing["items"]

    def month_key(dt: datetime) -> str:
        return f"{dt.year:04d}-{dt.month:02d}"

    current = [i for i in items if start <= i["transaction_date"] <= end]
    income = sum((i["amount"] for i in current if i["transaction_type"] == "income"), _ZERO)
    expense = sum((i["amount"] for i in current if i["transaction_type"] == "expense"), _ZERO)

    # previous month for variation
    prev_month_end = start - timedelta(microseconds=1)
    prev_start = prev_month_end.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    prev = [i for i in items if prev_start <= i["transaction_date"] <= prev_month_end]
    prev_income = sum((i["amount"] for i in prev if i["transaction_type"] == "income"), _ZERO)
    prev_expense = sum((i["amount"] for i in prev if i["transaction_type"] == "expense"), _ZERO)

    def variation(current_val: Decimal, prev_val: Decimal) -> Optional[Decimal]:
        if prev_val == _ZERO:
            return None
        return (current_val - prev_val) / prev_val

    # expenses by category (current month)
    by_cat: dict[str, dict] = {}
    for item in current:
        if item["transaction_type"] != "expense":
            continue
        key = str(item["category_id"] or "none")
        if key not in by_cat:
            by_cat[key] = {
                "category_id": item["category_id"],
                "category_name": item["category_name"] or "Sem categoria",
                "category_color": item["category_color"],
                "value": _ZERO,
            }
        by_cat[key]["value"] += item["amount"]
    by_category = sorted(by_cat.values(), key=lambda c: c["value"], reverse=True)
    for cat in by_category:
        cat["pct"] = cat["value"] / expense if expense > _ZERO else _ZERO

    # 12-month series
    months: dict[str, dict] = {}
    cursor = series_start
    while cursor <= end:
        months[month_key(cursor)] = {"month": month_key(cursor), "income": _ZERO, "expense": _ZERO}
        cursor = datetime(cursor.year + 1, 1, 1, tzinfo=timezone.utc) if cursor.month == 12 else datetime(cursor.year, cursor.month + 1, 1, tzinfo=timezone.utc)
    for item in items:
        bucket = months.get(month_key(item["transaction_date"]))
        if bucket is None:
            continue
        if item["transaction_type"] == "income":
            bucket["income"] += item["amount"]
        elif item["transaction_type"] == "expense":
            bucket["expense"] += item["amount"]

    return {
        "month": month,
        "income": income,
        "expense": expense,
        "net": income - expense,
        "income_prev_pct": variation(income, prev_income),
        "expense_prev_pct": variation(expense, prev_expense),
        "by_category": by_category,
        "monthly_series": list(months.values())[-12:],
    }


# ---------------------------------------------------------------------------
# Budgets
# ---------------------------------------------------------------------------

async def _month_spend_for_category(user_id: uuid.UUID, category_id: uuid.UUID, on_date: datetime, db: AsyncSession) -> Decimal:
    start, end = _month_bounds(f"{on_date.year:04d}-{on_date.month:02d}")
    result = await db.execute(
        select(sa_func.coalesce(sa_func.sum(FinancialTransaction.amount), _ZERO)).where(
            FinancialTransaction.user_id == user_id,
            FinancialTransaction.category_id == category_id,
            FinancialTransaction.transaction_type == "expense",
            FinancialTransaction.deleted_at.is_(None),
            FinancialTransaction.transaction_date >= start,
            FinancialTransaction.transaction_date <= end,
        )
    )
    return result.scalar() or _ZERO


async def _notify_if_budget_just_exceeded(
    user_id: uuid.UUID, category_id: uuid.UUID, txn_amount: Decimal, txn_date: datetime, db: AsyncSession,
) -> None:
    """Fire a notification the moment a category's monthly spend crosses its
    budget — not on every subsequent transaction once already over."""
    result = await db.execute(
        select(FinanceBudget).where(FinanceBudget.user_id == user_id, FinanceBudget.category_id == category_id)
    )
    budget = result.scalar_one_or_none()
    if not budget:
        return

    spend_after = await _month_spend_for_category(user_id, category_id, txn_date, db)
    spend_before = spend_after - txn_amount
    if spend_before <= budget.amount < spend_after:
        from src.notifications.service import create_notification
        category = await _get_category(category_id, user_id, db)
        await create_notification(
            user_id, "budget_exceeded",
            f"Orçamento de {category.name} estourado",
            f"Gasto do mês: {spend_after} / orçado: {budget.amount}",
            db,
        )


async def list_budgets(user_id: uuid.UUID, db: AsyncSession) -> list[dict]:
    result = await db.execute(
        select(FinanceBudget, FinanceCategory)
        .join(FinanceCategory, FinanceCategory.id == FinanceBudget.category_id)
        .where(FinanceBudget.user_id == user_id)
        .order_by(FinanceCategory.name)
    )
    now = datetime.now(timezone.utc)
    budgets = []
    for budget, category in result.all():
        spent = await _month_spend_for_category(user_id, category.id, now, db)
        budgets.append({
            "id": budget.id,
            "category_id": category.id,
            "category_name": category.name,
            "category_color": category.color,
            "amount": budget.amount,
            "period": budget.period,
            "spent": spent,
            "pct_used": (spent / budget.amount) if budget.amount > _ZERO else _ZERO,
        })
    return budgets


async def upsert_budget(user_id: uuid.UUID, category_id: uuid.UUID, amount: Decimal, db: AsyncSession) -> dict:
    await _get_category(category_id, user_id, db)  # 404 if not owned
    stmt = pg_insert(FinanceBudget).values(
        user_id=user_id, category_id=category_id, amount=amount,
    ).on_conflict_do_update(
        constraint="uq_finance_budgets_user_category", set_={"amount": amount},
    )
    await db.execute(stmt)
    await db.commit()
    budgets = await list_budgets(user_id, db)
    return next(b for b in budgets if b["category_id"] == category_id)


async def delete_budget(user_id: uuid.UUID, category_id: uuid.UUID, db: AsyncSession) -> None:
    result = await db.execute(
        select(FinanceBudget).where(FinanceBudget.user_id == user_id, FinanceBudget.category_id == category_id)
    )
    budget = result.scalar_one_or_none()
    if not budget:
        raise NotFoundError("Orçamento não encontrado")
    await db.delete(budget)
    await db.commit()


# ---------------------------------------------------------------------------
# Savings goals
# ---------------------------------------------------------------------------


async def _get_goal(goal_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> FinanceGoal:
    result = await db.execute(
        select(FinanceGoal).where(FinanceGoal.id == goal_id, FinanceGoal.user_id == user_id)
    )
    goal = result.scalar_one_or_none()
    if not goal:
        raise NotFoundError("Meta não encontrada")
    return goal


def _goal_to_dict(goal: FinanceGoal) -> dict:
    pct = (goal.current_amount / goal.target_amount) if goal.target_amount > _ZERO else _ZERO
    if pct > _ONE:
        pct = _ONE
    return {
        "id": goal.id,
        "name": goal.name,
        "target_amount": goal.target_amount,
        "current_amount": goal.current_amount,
        "pct_complete": pct,
        "target_date": goal.target_date,
        "color": goal.color,
        "icon": goal.icon,
        "is_archived": goal.is_archived,
        "is_complete": goal.current_amount >= goal.target_amount,
        "created_at": goal.created_at,
    }


async def list_goals(user_id: uuid.UUID, db: AsyncSession, *, include_archived: bool = False) -> list[dict]:
    query = select(FinanceGoal).where(FinanceGoal.user_id == user_id)
    if not include_archived:
        query = query.where(FinanceGoal.is_archived.is_(False))
    result = await db.execute(query.order_by(FinanceGoal.created_at))
    return [_goal_to_dict(g) for g in result.scalars().all()]


async def create_goal(
    user_id: uuid.UUID,
    name: str,
    target_amount: Decimal,
    target_date: Optional[date],
    color: Optional[str],
    icon: Optional[str],
    db: AsyncSession,
) -> dict:
    goal = FinanceGoal(
        user_id=user_id, name=name, target_amount=target_amount,
        target_date=target_date, color=color, icon=icon,
    )
    db.add(goal)
    await db.commit()
    await db.refresh(goal)
    return _goal_to_dict(goal)


async def update_goal(user_id: uuid.UUID, goal_id: uuid.UUID, updates: dict, db: AsyncSession) -> dict:
    goal = await _get_goal(goal_id, user_id, db)
    for field, value in updates.items():
        if value is not None:
            setattr(goal, field, value)
    await db.commit()
    await db.refresh(goal)
    return _goal_to_dict(goal)


async def delete_goal(user_id: uuid.UUID, goal_id: uuid.UUID, db: AsyncSession) -> None:
    goal = await _get_goal(goal_id, user_id, db)
    await db.delete(goal)
    await db.commit()


async def contribute_to_goal(
    user_id: uuid.UUID, goal_id: uuid.UUID, amount: Decimal, note: Optional[str], db: AsyncSession
) -> dict:
    """Add (or, with a negative amount, withdraw) funds from a goal.

    Fires a one-time "goal_reached" notification the first time current_amount
    crosses target_amount — same crossing-edge pattern as budget-exceeded
    notifications in this module, so re-contributing after the goal is
    already complete doesn't re-notify every time.
    """
    if amount == _ZERO:
        raise ValidationError("O valor do aporte não pode ser zero")
    goal = await _get_goal(goal_id, user_id, db)
    was_complete = goal.current_amount >= goal.target_amount
    goal.current_amount = goal.current_amount + amount

    contribution = FinanceGoalContribution(goal_id=goal.id, user_id=user_id, amount=amount, note=note)
    db.add(contribution)
    await db.commit()
    await db.refresh(goal)

    if not was_complete and goal.current_amount >= goal.target_amount:
        from src.notifications.service import create_notification
        await create_notification(
            user_id, "goal_reached",
            f'Meta "{goal.name}" concluída!',
            f"Você atingiu {goal.current_amount} de {goal.target_amount}.",
            db,
        )

    return _goal_to_dict(goal)


async def list_goal_contributions(
    user_id: uuid.UUID, goal_id: uuid.UUID, db: AsyncSession
) -> list[FinanceGoalContribution]:
    await _get_goal(goal_id, user_id, db)  # 404/ownership check
    result = await db.execute(
        select(FinanceGoalContribution)
        .where(FinanceGoalContribution.goal_id == goal_id, FinanceGoalContribution.user_id == user_id)
        .order_by(FinanceGoalContribution.contributed_at.desc())
    )
    return list(result.scalars().all())
