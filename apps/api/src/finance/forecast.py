"""Projeção de fluxo de caixa.

Separa, mês a mês, o que já é conhecido (recorrências e parcelas futuras já
materializadas, faturas de cartão em aberto) do que é só estatística
(mediana dos últimos 6 meses por categoria sem essa cobertura) — para o
gráfico desenhar uma linha sólida (comprometido) e uma faixa de incerteza
(realista = comprometido + estimado) em vez de fingir uma certeza que não
existe.

Mediana, não média: um seguro anual pago uma vez só distorceria a média para
sempre, inflando a projeção justamente onde ela mais precisa acertar. Com
mediana, um gasto isolado em 1 de 6 meses puxa a estimativa para perto de
zero — que é o comportamento certo para algo que não se repete.
"""
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from statistics import median
from typing import Optional

from dateutil.relativedelta import relativedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.cards.models import CardInvoice
from src.finance import service as finance_service
from src.finance.account_models import BankAccount

_ZERO = Decimal("0")
_BASELINE_MONTHS = 6


def _month_key(dt: datetime) -> str:
    return f"{dt.year:04d}-{dt.month:02d}"


def _month_start(dt: datetime) -> datetime:
    return dt.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


async def _open_invoices_by_month(user_id: uuid.UUID, db: AsyncSession) -> dict[str, Decimal]:
    """Faturas com total conhecido mas ainda não confirmadas — confirmadas já
    viraram transações reais, contá-las de novo duplicaria."""
    result = await db.execute(
        select(CardInvoice.due_date, CardInvoice.total_amount).where(
            CardInvoice.user_id == user_id,
            CardInvoice.status.in_(("processing", "review")),
            CardInvoice.total_amount.isnot(None),
            CardInvoice.due_date.isnot(None),
        )
    )
    by_month: dict[str, Decimal] = {}
    for due_date, total in result.all():
        key = f"{due_date.year:04d}-{due_date.month:02d}"
        by_month[key] = by_month.get(key, _ZERO) + total
    return by_month


async def get_forecast(
    user_id: uuid.UUID,
    db: AsyncSession,
    *,
    months: int = 6,
    account_id: Optional[uuid.UUID] = None,
) -> dict:
    now = datetime.now(timezone.utc)
    this_month_start = _month_start(now)
    baseline_start = this_month_start - relativedelta(months=_BASELINE_MONTHS)
    horizon_end = this_month_start + relativedelta(months=months) - timedelta(microseconds=1)

    listing = await finance_service.list_transactions(
        user_id, db,
        date_from=baseline_start, date_to=horizon_end,
        account_id=account_id, per_page=100_000,
    )
    items = listing["items"]

    # Saldo de partida: da conta escolhida, ou o total das contas somadas no
    # consolidado (mesma regra de include_in_total do cartão de saldos).
    balances = await finance_service._account_balances(user_id, db)
    if account_id:
        current_balance = balances.get(account_id, _ZERO)
    else:
        accounts_result = await db.execute(
            select(BankAccount.id).where(
                BankAccount.user_id == user_id,
                BankAccount.is_active.is_(True),
                BankAccount.include_in_total.is_(True),
            )
        )
        included_ids = {row[0] for row in accounts_result.all()}
        current_balance = sum((balances.get(aid, _ZERO) for aid in included_ids), _ZERO)

    baseline_months = [
        _month_key(this_month_start - relativedelta(months=i))
        for i in range(1, _BASELINE_MONTHS + 1)
    ]

    # (tipo, categoria) -> {mês: valor} — só passado real, para a mediana.
    history: dict[tuple[str, str], dict[str, Decimal]] = {}
    # mês -> {"income": X, "expense": Y} — linhas reais já conhecidas (feitas
    # ou agendadas): recorrência expandida + parcela já materializada.
    committed_by_month: dict[str, dict[str, Decimal]] = {}
    # (mês, categoria) já tem cobertura conhecida — não precisa de estimativa.
    covered: set[tuple[str, str]] = set()

    for item in items:
        if item["transaction_type"] == "transfer":
            continue
        txn_date = item["transaction_date"]
        if txn_date.tzinfo is None:
            txn_date = txn_date.replace(tzinfo=timezone.utc)
        month = _month_key(txn_date)
        category_key = str(item["category_id"] or "none")
        amount = Decimal(str(item["amount"]))

        if txn_date < this_month_start:
            # Mês fechado — entra na mediana da linha de base.
            bucket = history.setdefault((item["transaction_type"], category_key), {})
            bucket[month] = bucket.get(month, _ZERO) + amount
        elif txn_date <= now:
            # Já aconteceu neste mês corrente: já está embutido em
            # current_balance (que soma tudo até agora). Contar de novo aqui
            # duplicaria — nem é "comprometido futuro" nem "mês fechado".
            continue
        else:
            covered.add((month, category_key))
            bucket = committed_by_month.setdefault(month, {"income": _ZERO, "expense": _ZERO})
            bucket[item["transaction_type"]] += amount

    invoices_by_month = await _open_invoices_by_month(user_id, db)

    months_list = [this_month_start + relativedelta(months=i) for i in range(months)]
    result_months: list[dict] = []
    cumulative_committed = _ZERO
    cumulative_realistic = _ZERO
    negative_from: Optional[str] = None

    for dt in months_list:
        m = _month_key(dt)
        committed = committed_by_month.get(m, {"income": _ZERO, "expense": _ZERO})
        committed_income = committed["income"]
        committed_expense = committed["expense"] + invoices_by_month.get(m, _ZERO)

        estimated_income = _ZERO
        estimated_expense = _ZERO
        for (txn_type, category_key), monthly in history.items():
            if (m, category_key) in covered:
                continue
            values = [monthly.get(bm, _ZERO) for bm in baseline_months]
            typical = median(values) if values else _ZERO
            if typical <= _ZERO:
                continue
            if txn_type == "income":
                estimated_income += typical
            else:
                estimated_expense += typical

        cumulative_committed += committed_income - committed_expense
        cumulative_realistic += (committed_income + estimated_income) - (committed_expense + estimated_expense)

        if negative_from is None and current_balance + cumulative_realistic < 0:
            negative_from = m

        result_months.append({
            "month": m,
            "committed_income": committed_income,
            "committed_expense": committed_expense,
            "estimated_income": estimated_income,
            "estimated_expense": estimated_expense,
            "balance_committed": current_balance + cumulative_committed,
            "balance_realistic": current_balance + cumulative_realistic,
        })

    return {
        "current_balance": current_balance,
        "months": result_months,
        "negative_from": negative_from,
    }
