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
from decimal import Decimal, ROUND_DOWN
from typing import Optional

from dateutil.relativedelta import relativedelta
from dateutil.rrule import rrulestr
from sqlalchemy import select, or_, and_ as sa_and, case as sa_case, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from sqlalchemy.dialects.postgresql import insert as pg_insert

from src.finance import categorizer
from src.finance.models import FinanceCategory, FinancialTransaction
from src.finance.account_models import BankAccount
from src.finance.budget_models import FinanceBudget
from src.finance.goal_models import FinanceGoal, FinanceGoalContribution
from src.shared.exceptions import NotFoundError, ConflictError, ValidationError
from src.shared.fx import get_fx_rates_to_brl

logger = logging.getLogger(__name__)

_ZERO = Decimal("0")
_ONE = Decimal("1")
_CENT = Decimal("0.01")

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


# ---------------------------------------------------------------------------
# Accounts
#
# O saldo nunca é guardado: o módulo de cartões escreve transações por fora
# deste serviço e a importação de extrato grava em lote, então qualquer total
# mantido à mão divergiria com o tempo. Deriva-se sempre, numa query só.
# ---------------------------------------------------------------------------

async def _account_balances(user_id: uuid.UUID, db: AsyncSession) -> dict[uuid.UUID, Decimal]:
    """Saldo derivado de todas as contas do usuário, em uma única query.

    Só conta lançamentos até agora: parcelas futuras já materializadas não
    podem inflar o saldo de hoje. Ocorrências recorrentes virtuais não são
    linhas, então ficam naturalmente de fora — que é o comportamento certo."""
    txn = FinancialTransaction
    delta = sa_case(
        (sa_and(txn.bank_account_id == BankAccount.id, txn.transaction_type == "income"), txn.amount_brl),
        (sa_and(txn.bank_account_id == BankAccount.id, txn.transaction_type == "expense"), -txn.amount_brl),
        (sa_and(txn.bank_account_id == BankAccount.id, txn.transaction_type == "transfer"), -txn.amount_brl),
        (sa_and(txn.to_bank_account_id == BankAccount.id, txn.transaction_type == "transfer"), txn.amount_brl),
        else_=_ZERO,
    )
    result = await db.execute(
        select(BankAccount.id, BankAccount.opening_balance + sa_func.coalesce(sa_func.sum(delta), _ZERO))
        .outerjoin(
            txn,
            sa_and(
                or_(txn.bank_account_id == BankAccount.id, txn.to_bank_account_id == BankAccount.id),
                txn.deleted_at.is_(None),
                txn.transaction_date <= sa_func.now(),
            ),
        )
        .where(BankAccount.user_id == user_id)
        .group_by(BankAccount.id, BankAccount.opening_balance)
    )
    return {row[0]: row[1] for row in result.all()}


def _account_to_dict(account: BankAccount, balance: Decimal) -> dict:
    return {
        "id": account.id,
        "name": account.name,
        "account_type": account.account_type,
        "institution": account.institution,
        "holder": account.holder,
        "opening_balance": account.opening_balance,
        "balance": balance,
        "currency": account.currency,
        "color": account.color,
        "icon": account.icon,
        "include_in_total": account.include_in_total,
        "portfolio_id": account.portfolio_id,
        "is_active": account.is_active,
    }


async def list_accounts(user_id: uuid.UUID, db: AsyncSession, *, include_inactive: bool = False) -> list[dict]:
    query = select(BankAccount).where(BankAccount.user_id == user_id)
    if not include_inactive:
        query = query.where(BankAccount.is_active.is_(True))
    accounts = list((await db.execute(query.order_by(BankAccount.name))).scalars().all())
    balances = await _account_balances(user_id, db)
    return [_account_to_dict(a, balances.get(a.id, a.opening_balance)) for a in accounts]


async def create_account(user_id: uuid.UUID, data: dict, db: AsyncSession) -> dict:
    existing = await db.execute(
        select(BankAccount).where(BankAccount.user_id == user_id, BankAccount.name == data["name"])
    )
    if existing.scalar_one_or_none():
        raise ConflictError(f"Já existe uma conta chamada '{data['name']}'")
    account = BankAccount(user_id=user_id, **data)
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return _account_to_dict(account, account.opening_balance)


async def update_account(account_id: uuid.UUID, user_id: uuid.UUID, updates: dict, db: AsyncSession) -> dict:
    account = await _validate_account(account_id, user_id, db)
    for field, value in updates.items():
        if value is not None:
            setattr(account, field, value)
    await db.commit()
    await db.refresh(account)
    balances = await _account_balances(user_id, db)
    return _account_to_dict(account, balances.get(account.id, account.opening_balance))


async def archive_account(account_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> None:
    """Arquiva em vez de apagar — as transações históricas apontam para ela."""
    account = await _validate_account(account_id, user_id, db)
    account.is_active = False
    await db.commit()


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
        "amount_brl": txn.amount_brl,
        "currency": txn.currency,
        "description": txn.description,
        "notes": txn.notes,
        "category_id": txn.category_id,
        "category_name": txn.category.name if txn.category else None,
        "category_color": txn.category.color if txn.category else None,
        "bank_account_id": txn.bank_account_id,
        "bank_account_name": txn.bank_account.name if txn.bank_account else None,
        "to_bank_account_id": txn.to_bank_account_id,
        "to_bank_account_name": txn.to_bank_account.name if txn.to_bank_account else None,
        "transaction_date": virtual_date or txn.transaction_date,
        # Ocorrência virtual não é uma linha real — não há o que "pagar" nela,
        # então ela sai sempre como já paga (esconde o botão "Pagar" na UI).
        "due_date": virtual_date or txn.due_date,
        "is_paid": True if virtual_date else txn.is_paid,
        "paid_at": None if virtual_date else txn.paid_at,
        "is_recurring": txn.is_recurring,
        "recurrence_rule": txn.recurrence_rule,
        "installment_no": txn.installment_no,
        "installment_total": txn.installment_total,
        "source": txn.source,
        "is_virtual": virtual_date is not None,
        "tags": _parse_tags(txn.tags),
    }


def _txn_relations() -> tuple:
    """Eager-load de categoria e das duas contas.

    É função, não constante de módulo: `selectinload(Model.attr)` resolve o
    mapper na hora em que é avaliado, e no import de `service` nem todos os
    models do app foram importados ainda — o que quebrava a configuração dos
    mappers antes de qualquer query rodar."""
    return (
        selectinload(FinancialTransaction.category),
        selectinload(FinancialTransaction.bank_account),
        selectinload(FinancialTransaction.to_bank_account),
    )


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
    account_id: Optional[uuid.UUID] = None,
    holder: Optional[str] = None,
    page: int = 1,
    per_page: int = 50,
) -> dict:
    """Filtered listing; expands recurring templates virtually inside the window."""
    query = (
        select(FinancialTransaction)
        .options(*_txn_relations())
        .where(
            FinancialTransaction.user_id == user_id,
            FinancialTransaction.deleted_at.is_(None),
        )
    )
    if category_id:
        query = query.where(FinancialTransaction.category_id == category_id)
    if account_id:
        # Uma transferência aparece no extrato das duas contas envolvidas.
        query = query.where(
            or_(
                FinancialTransaction.bank_account_id == account_id,
                FinancialTransaction.to_bank_account_id == account_id,
            )
        )
    if holder:
        holder_accounts = select(BankAccount.id).where(
            BankAccount.user_id == user_id, BankAccount.holder == holder
        )
        query = query.where(
            or_(
                FinancialTransaction.bank_account_id.in_(holder_accounts),
                FinancialTransaction.to_bank_account_id.in_(holder_accounts),
            )
        )
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


def _split_installments(total: Decimal, count: int) -> list[Decimal]:
    """Divide um total em `count` parcelas que somam exatamente o total.

    Arredonda cada parcela para baixo e joga o resto dos centavos na última —
    R$ 100 em 3x vira 33,33 / 33,33 / 33,34, não três vezes 33,33 (que
    perderia um centavo) nem três vezes 33,34 (que criaria dois)."""
    per = (total / count).quantize(_CENT, rounding=ROUND_DOWN)
    parts = [per] * (count - 1)
    parts.append(total - per * (count - 1))
    return parts


async def _validate_account(account_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> BankAccount:
    result = await db.execute(
        select(BankAccount).where(BankAccount.id == account_id, BankAccount.user_id == user_id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise NotFoundError("Conta não encontrada")
    return account


async def create_transaction(user_id: uuid.UUID, data: dict, db: AsyncSession) -> dict:
    txn_type = data["transaction_type"]
    if data.get("category_id"):
        await _get_category(data["category_id"], user_id, db)
    if data.get("bank_account_id"):
        await _validate_account(data["bank_account_id"], user_id, db)

    to_account_id = data.get("to_bank_account_id")
    if txn_type == "transfer":
        if not to_account_id or not data.get("bank_account_id"):
            raise ValidationError("Transferência exige conta de origem e de destino")
        if to_account_id == data["bank_account_id"]:
            raise ValidationError("A conta de destino precisa ser diferente da de origem")
        await _validate_account(to_account_id, user_id, db)
    else:
        to_account_id = None

    count = int(data.get("installments") or 1)
    if count > 1 and data.get("recurrence_rule"):
        raise ValidationError("Uma transação parcelada não pode também ser recorrente")

    currency = data.get("currency") or "BRL"
    if data.get("fx_rate"):
        rate = Decimal(data["fx_rate"])
    elif currency != "BRL":
        # Sem UI de moeda estrangeira ainda — mas quando currency vier de
        # importação/API, trava a cotação real do dia em vez de assumir 1:1,
        # que mentiria no histórico assim que uma moeda estrangeira aparecer.
        rates = await get_fx_rates_to_brl({currency}, db)
        rate = rates.get(currency, _ONE)
    else:
        rate = _ONE
    amounts = _split_installments(data["amount"], count) if count > 1 else [data["amount"]]
    group_id = uuid.uuid4() if count > 1 else None
    base_date = data["transaction_date"]
    base_due = data.get("due_date") or base_date
    if base_due.tzinfo is None:
        base_due = base_due.replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    source = data.get("source") or ("installment" if count > 1 else "manual")

    created: list[FinancialTransaction] = []
    for index, part in enumerate(amounts):
        # Cada parcela vence um mês depois da anterior, igual à data de
        # lançamento — só a primeira herda um vencimento diferente da data
        # de lançamento quando o usuário informa um.
        due = base_due + relativedelta(months=index)
        # Vencimento no futuro fica pendente até o botão "Pagar" (ou o
        # worker de vencimento, no dia certo) confirmar — nunca marcado
        # pago sozinho só porque a linha foi criada.
        paid = due <= now
        txn = FinancialTransaction(
            user_id=user_id,
            transaction_type=txn_type,
            amount=part,
            currency=currency,
            fx_rate=rate,
            amount_brl=part * rate,
            description=data.get("description"),
            notes=data.get("notes"),
            category_id=data.get("category_id") if txn_type != "transfer" else None,
            bank_account_id=data.get("bank_account_id"),
            to_bank_account_id=to_account_id,
            transaction_date=base_date + relativedelta(months=index),
            due_date=due,
            is_paid=paid,
            paid_at=now if paid else None,
            # Parcelas nunca são recorrentes: é o que as mantém fora de
            # expand_recurring e elimina qualquer contagem em dobro.
            is_recurring=bool(data.get("recurrence_rule")) and count == 1,
            recurrence_rule=data.get("recurrence_rule") if count == 1 else None,
            installment_group_id=group_id,
            installment_no=index + 1 if count > 1 else None,
            installment_total=count if count > 1 else None,
            source=source,
            external_id=data.get("external_id"),
            tags=json.dumps(data.get("tags") or []),
        )
        db.add(txn)
        created.append(txn)

    await db.commit()
    first = created[0]
    await db.refresh(first, attribute_names=["category", "bank_account", "to_bank_account"])

    if first.transaction_type == "expense" and first.category_id:
        await _notify_if_budget_just_exceeded(
            user_id, first.category_id, first.amount_brl, first.transaction_date, db,
            account_id=first.bank_account_id,
        )

    # Digitar uma transação com descrição e categoria é o sinal de treino mais
    # direto que existe — a próxima vez que a mesma loja aparecer, já vem
    # categorizada. Só para lançamento manual: import/fatura já carregam sua
    # própria origem de sugestão e reaprender delas em massa seria ruído.
    if source == "manual" and first.category_id and first.description:
        await categorizer.learn_from_correction(user_id, first.description, first.category_id, db)
        await db.commit()

    return _txn_to_dict(first)


async def _get_transaction(txn_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> FinancialTransaction:
    result = await db.execute(
        select(FinancialTransaction)
        .options(*_txn_relations())
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
    old_category_id = txn.category_id
    if updates.get("category_id"):
        await _get_category(updates["category_id"], user_id, db)
    for field in ("bank_account_id", "to_bank_account_id"):
        if updates.get(field):
            await _validate_account(updates[field], user_id, db)
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
    # amount_brl é o que toda agregação soma; deixá-lo defasado após uma
    # edição de valor faria os totais divergirem do extrato em silêncio.
    txn.amount_brl = txn.amount * (txn.fx_rate or _ONE)
    await db.commit()
    await db.refresh(txn, attribute_names=["category", "bank_account", "to_bank_account"])

    # Trocar a categoria é uma correção deliberada — o sinal de treino mais
    # forte que existe, inclusive sobre uma sugestão de IA aceita antes.
    new_category_id = updates.get("category_id")
    if new_category_id and new_category_id != old_category_id and txn.description:
        await categorizer.learn_from_correction(user_id, txn.description, new_category_id, db)
        await db.commit()

    return _txn_to_dict(txn)


async def mark_transaction_paid(txn_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> dict:
    """Botão "Pagar" — confirma que o vencimento lançado antecipadamente
    foi efetivamente pago hoje. Idempotente: clicar de novo numa transação
    já paga só devolve o estado atual."""
    txn = await _get_transaction(txn_id, user_id, db)
    if not txn.is_paid:
        txn.is_paid = True
        txn.paid_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(txn, attribute_names=["category", "bank_account", "to_bank_account"])
    return _txn_to_dict(txn)


async def delete_transaction(
    txn_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession,
    *,
    scope: str = "one",
) -> int:
    """Soft-delete. `scope` só importa para parcelamentos:
    one = só esta parcela · future = esta e as seguintes · all = a série inteira.
    Apagar o template de uma recorrência encerra a série, como antes."""
    txn = await _get_transaction(txn_id, user_id, db)
    now = datetime.now(timezone.utc)

    if scope == "one" or not txn.installment_group_id:
        txn.deleted_at = now
        await db.commit()
        return 1

    query = select(FinancialTransaction).where(
        FinancialTransaction.user_id == user_id,
        FinancialTransaction.installment_group_id == txn.installment_group_id,
        FinancialTransaction.deleted_at.is_(None),
    )
    if scope == "future":
        query = query.where(FinancialTransaction.transaction_date >= txn.transaction_date)

    rows = list((await db.execute(query)).scalars().all())
    for row in rows:
        row.deleted_at = now
    await db.commit()
    return len(rows)


# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

def _month_bounds(month: str) -> tuple[datetime, datetime]:
    year, mon = int(month[:4]), int(month[5:7])
    start = datetime(year, mon, 1, tzinfo=timezone.utc)
    end = datetime(year + 1, 1, 1, tzinfo=timezone.utc) if mon == 12 else datetime(year, mon + 1, 1, tzinfo=timezone.utc)
    return start, end - timedelta(microseconds=1)


async def get_summary(
    user_id: uuid.UUID,
    month: str,
    db: AsyncSession,
    *,
    account_id: Optional[uuid.UUID] = None,
    holder: Optional[str] = None,
) -> dict:
    """Monthly totals + expenses by category + 12-month flow, recurrences included."""
    start, end = _month_bounds(month)
    series_start = (start - timedelta(days=365)).replace(day=1)

    listing = await list_transactions(
        user_id, db, date_from=series_start, date_to=end, per_page=100_000,
        account_id=account_id, holder=holder,
    )
    items = listing["items"]

    def month_key(dt: datetime) -> str:
        return f"{dt.year:04d}-{dt.month:02d}"

    current = [i for i in items if start <= i["transaction_date"] <= end]
    income = sum((i["amount_brl"] for i in current if i["transaction_type"] == "income"), _ZERO)
    expense = sum((i["amount_brl"] for i in current if i["transaction_type"] == "expense"), _ZERO)

    # previous month for variation
    prev_month_end = start - timedelta(microseconds=1)
    prev_start = prev_month_end.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    prev = [i for i in items if prev_start <= i["transaction_date"] <= prev_month_end]
    prev_income = sum((i["amount_brl"] for i in prev if i["transaction_type"] == "income"), _ZERO)
    prev_expense = sum((i["amount_brl"] for i in prev if i["transaction_type"] == "expense"), _ZERO)

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
        by_cat[key]["value"] += item["amount_brl"]
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
            bucket["income"] += item["amount_brl"]
        elif item["transaction_type"] == "expense":
            bucket["expense"] += item["amount_brl"]

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

async def _month_spend_for_category(
    user_id: uuid.UUID,
    category_id: uuid.UUID,
    on_date: datetime,
    db: AsyncSession,
    *,
    account_id: Optional[uuid.UUID] = None,
) -> Decimal:
    """Gasto do mês na categoria, em BRL — via `list_transactions` (não SQL
    puro) para enxergar ocorrências recorrentes virtuais, do mesmo jeito que
    `get_summary` já faz. Antes disso divergiam: o orçamento não via uma
    despesa recorrente que ainda não virou linha, e `get_summary` via."""
    start, end = _month_bounds(f"{on_date.year:04d}-{on_date.month:02d}")
    listing = await list_transactions(
        user_id, db, date_from=start, date_to=end,
        category_id=category_id, transaction_type="expense", per_page=100_000,
        account_id=account_id,
    )
    return sum((item["amount_brl"] for item in listing["items"]), _ZERO)


async def _notify_if_budget_just_exceeded(
    user_id: uuid.UUID,
    category_id: uuid.UUID,
    txn_amount: Decimal,
    txn_date: datetime,
    db: AsyncSession,
    *,
    account_id: Optional[uuid.UUID] = None,
) -> None:
    """Fire a notification the moment a category's monthly spend crosses its
    budget — not on every subsequent transaction once already over.

    A despesa conta para dois tetos ao mesmo tempo: o da carteira em que ela
    caiu e o consolidado. Cada um é medido contra o gasto do seu próprio
    escopo, senão o orçamento da carteira estouraria com gasto de outra."""
    query = select(FinanceBudget).where(
        FinanceBudget.user_id == user_id, FinanceBudget.category_id == category_id
    )
    if account_id is None:
        query = query.where(FinanceBudget.bank_account_id.is_(None))
    else:
        query = query.where(
            or_(
                FinanceBudget.bank_account_id.is_(None),
                FinanceBudget.bank_account_id == account_id,
            )
        )
    budgets = (await db.execute(query)).scalars().all()
    if not budgets:
        return

    category = None
    for budget in budgets:
        scope = budget.bank_account_id
        spend_after = await _month_spend_for_category(
            user_id, category_id, txn_date, db, account_id=scope
        )
        spend_before = spend_after - txn_amount
        if not (spend_before <= budget.amount < spend_after):
            continue
        from src.notifications.service import create_notification
        if category is None:
            category = await _get_category(category_id, user_id, db)
        await create_notification(
            user_id, "budget_exceeded",
            f"Orçamento de {category.name} estourado",
            f"Gasto do mês: {spend_after} / orçado: {budget.amount}",
            db,
        )


async def list_budgets(
    user_id: uuid.UUID,
    db: AsyncSession,
    *,
    account_id: Optional[uuid.UUID] = None,
    holder: Optional[str] = None,
) -> list[dict]:
    """Orçamentos da carteira escolhida — ou os consolidados, quando nenhuma
    está ativa. Um teto por categoria valia para todas as contas somadas, o
    que inviabiliza administrar duas carteiras (a própria e a de outra
    pessoa) com limites independentes."""
    query = (
        select(FinanceBudget, FinanceCategory)
        .join(FinanceCategory, FinanceCategory.id == FinanceBudget.category_id)
        .where(FinanceBudget.user_id == user_id)
        .order_by(FinanceCategory.name)
    )
    query = query.where(
        FinanceBudget.bank_account_id == account_id if account_id
        else FinanceBudget.bank_account_id.is_(None)
    )
    result = await db.execute(query)
    rows = result.all()
    now = datetime.now(timezone.utc)
    start, end = _month_bounds(f"{now.year:04d}-{now.month:02d}")
    # Uma única listagem do mês para todos os orçamentos, em vez de uma
    # query por orçamento — e reaproveita expand_recurring, então enxerga
    # despesas recorrentes que ainda não viraram linha, como get_summary.
    listing = await list_transactions(
        user_id, db, date_from=start, date_to=end, transaction_type="expense", per_page=100_000,
        account_id=account_id, holder=holder,
    )
    spend_by_category: dict[uuid.UUID, Decimal] = {}
    for item in listing["items"]:
        if item["category_id"] is None:
            continue
        spend_by_category[item["category_id"]] = spend_by_category.get(item["category_id"], _ZERO) + item["amount_brl"]

    budgets = []
    for budget, category in rows:
        spent = spend_by_category.get(category.id, _ZERO)
        budgets.append({
            "id": budget.id,
            "category_id": category.id,
            "category_name": category.name,
            "category_color": category.color,
            "bank_account_id": budget.bank_account_id,
            "amount": budget.amount,
            "period": budget.period,
            "spent": spent,
            "pct_used": (spent / budget.amount) if budget.amount > _ZERO else _ZERO,
        })
    return budgets


async def upsert_budget(
    user_id: uuid.UUID,
    category_id: uuid.UUID,
    amount: Decimal,
    db: AsyncSession,
    *,
    account_id: Optional[uuid.UUID] = None,
) -> dict:
    await _get_category(category_id, user_id, db)  # 404 if not owned
    if account_id is not None:
        await _validate_account(account_id, user_id, db)  # 404 if not owned
    stmt = pg_insert(FinanceBudget).values(
        user_id=user_id, category_id=category_id, bank_account_id=account_id, amount=amount,
    ).on_conflict_do_update(
        constraint="uq_finance_budgets_user_category", set_={"amount": amount},
    )
    await db.execute(stmt)
    await db.commit()
    budgets = await list_budgets(user_id, db, account_id=account_id)
    return next(b for b in budgets if b["category_id"] == category_id)


async def delete_budget(
    user_id: uuid.UUID,
    category_id: uuid.UUID,
    db: AsyncSession,
    *,
    account_id: Optional[uuid.UUID] = None,
) -> None:
    query = select(FinanceBudget).where(
        FinanceBudget.user_id == user_id, FinanceBudget.category_id == category_id
    )
    query = query.where(
        FinanceBudget.bank_account_id == account_id if account_id
        else FinanceBudget.bank_account_id.is_(None)
    )
    result = await db.execute(query)
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
