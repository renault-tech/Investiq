"""Análises financeiras — burn rate, taxa de poupança, fôlego, tendência por
categoria e comparativo mês a mês. Tudo derivado das mesmas transações que
`get_summary` e `get_forecast` já consultam; nenhuma tabela nova.
"""
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from statistics import median
from typing import Optional

from dateutil.relativedelta import relativedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.finance import service as finance_service
from src.finance.account_models import BankAccount

_ZERO = Decimal("0")
_BURN_RATE_MONTHS = 3
_TREND_BASELINE_MONTHS = 6
_TREND_THRESHOLD = Decimal("0.2")  # ±20% para marcar tendência como relevante


def _month_key(dt: datetime) -> str:
    return f"{dt.year:04d}-{dt.month:02d}"


def _month_start(dt: datetime) -> datetime:
    return dt.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


async def get_analytics(
    user_id: uuid.UUID,
    db: AsyncSession,
    *,
    months: int = 6,
    account_id: Optional[uuid.UUID] = None,
    holder: Optional[str] = None,
) -> dict:
    now = datetime.now(timezone.utc)
    this_month_start = _month_start(now)
    window_months = max(months, _TREND_BASELINE_MONTHS)
    date_from = this_month_start - relativedelta(months=window_months)

    listing = await finance_service.list_transactions(
        user_id, db, date_from=date_from, date_to=now, per_page=100_000,
        account_id=account_id, holder=holder,
    )
    items = [i for i in listing["items"] if i["transaction_type"] != "transfer"]

    totals_by_month: dict[str, dict[str, Decimal]] = {}
    expense_by_category_month: dict[str, dict[str, Decimal]] = {}
    category_meta: dict[str, dict] = {}

    for item in items:
        month = _month_key(item["transaction_date"])
        amount = Decimal(str(item["amount_brl"]))
        bucket = totals_by_month.setdefault(month, {"income": _ZERO, "expense": _ZERO})
        bucket[item["transaction_type"]] += amount

        if item["transaction_type"] == "expense":
            category_key = str(item["category_id"] or "none")
            category_meta.setdefault(category_key, {
                "category_id": item["category_id"],
                "category_name": item["category_name"] or "Sem categoria",
                "category_color": item["category_color"],
            })
            cat_bucket = expense_by_category_month.setdefault(category_key, {})
            cat_bucket[month] = cat_bucket.get(month, _ZERO) + amount

    # Eixo comum da série e da matriz: os últimos `months`, do mais antigo ao
    # corrente (inclusive, mesmo parcial).
    display_months = [
        _month_key(this_month_start - relativedelta(months=i))
        for i in range(months - 1, -1, -1)
    ]
    # Linha de base da mediana: meses FECHADOS antes do corrente — um mês
    # parcial não é um "mês típico" para comparar tendência.
    baseline_months = [
        _month_key(this_month_start - relativedelta(months=i))
        for i in range(1, _TREND_BASELINE_MONTHS + 1)
    ]
    # Burn rate: só meses fechados também, pelo mesmo motivo.
    burn_rate_months = [
        _month_key(this_month_start - relativedelta(months=i))
        for i in range(1, _BURN_RATE_MONTHS + 1)
    ]

    burn_values = [totals_by_month.get(m, {"expense": _ZERO}).get("expense", _ZERO) for m in burn_rate_months]
    burn_rate = (sum(burn_values, _ZERO) / len(burn_values)) if burn_values else _ZERO

    savings_series = []
    for m in display_months:
        bucket = totals_by_month.get(m, {"income": _ZERO, "expense": _ZERO})
        income, expense = bucket["income"], bucket["expense"]
        rate = ((income - expense) / income) if income > _ZERO else None
        savings_series.append({"month": m, "income": income, "expense": expense, "savings_rate": rate})

    # Fôlego: saldo das contas do escopo ativo (uma conta, um titular, ou o
    # consolidado inteiro) ÷ burn rate — precisa acompanhar o mesmo filtro
    # que já reduziu `listing`, senão a projeção mistura contas de fora.
    balances = await finance_service._account_balances(user_id, db)
    accounts_query = select(BankAccount.id).where(
        BankAccount.user_id == user_id,
        BankAccount.is_active.is_(True),
        BankAccount.include_in_total.is_(True),
    )
    if account_id:
        accounts_query = accounts_query.where(BankAccount.id == account_id)
    elif holder:
        accounts_query = accounts_query.where(BankAccount.holder == holder)
    accounts_result = await db.execute(accounts_query)
    included_ids = {row[0] for row in accounts_result.all()}
    total_balance = sum((balances.get(aid, _ZERO) for aid in included_ids), _ZERO)
    runway_months = (total_balance / burn_rate) if burn_rate > _ZERO else None

    current_month_key = _month_key(this_month_start)
    category_trends = []
    for category_key, monthly in expense_by_category_month.items():
        current_amount = monthly.get(current_month_key, _ZERO)
        baseline_values = [monthly.get(bm, _ZERO) for bm in baseline_months]
        baseline = median(baseline_values) if baseline_values else _ZERO

        if baseline > _ZERO:
            pct_change: Optional[Decimal] = (current_amount - baseline) / baseline
        else:
            pct_change = None

        if pct_change is not None and pct_change > _TREND_THRESHOLD:
            direction = "up"
        elif pct_change is not None and pct_change < -_TREND_THRESHOLD:
            direction = "down"
        elif pct_change is None and current_amount > _ZERO:
            direction = "up"   # gasto novo, sem histórico nos meses fechados
        else:
            direction = "stable"

        meta = category_meta[category_key]
        category_trends.append({
            "category_id": meta["category_id"],
            "category_name": meta["category_name"],
            "category_color": meta["category_color"],
            "current_amount": current_amount,
            "baseline_median": baseline,
            "pct_change": pct_change,
            "direction": direction,
        })
    category_trends.sort(key=lambda t: t["current_amount"], reverse=True)

    category_matrix = []
    for category_key, monthly in expense_by_category_month.items():
        meta = category_meta[category_key]
        category_matrix.append({
            "category_id": meta["category_id"],
            "category_name": meta["category_name"],
            "category_color": meta["category_color"],
            "values": [monthly.get(m, _ZERO) for m in display_months],
        })
    category_matrix.sort(key=lambda row: sum(row["values"], _ZERO), reverse=True)

    return {
        "months": display_months,
        "burn_rate": burn_rate,
        "savings_series": savings_series,
        "runway_months": runway_months,
        "category_trends": category_trends,
        "category_matrix": category_matrix,
    }
