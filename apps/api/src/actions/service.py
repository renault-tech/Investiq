"""Central de Ações — agrega pendências que já existem em Finanças e Cartões
num único inbox priorizado, sem tabela nova: nada aqui é fonte de verdade,
é leitura computada sob demanda (mesma filosofia de cards/analytics.py).

Ordem: vencida > vence em ≤3 dias > vence em ≤7 dias > fatura em revisão
(sem prazo definido) > item sem categoria (o mais baixo — não é urgente, é
higiene de dados). Dentro do mesmo nível, prazo mais curto primeiro e, em
seguida, maior valor: R$ 4.000 vencendo hoje pesa mais que R$ 40 vencendo
hoje, mas nunca mais que algo já vencido.
"""
import uuid
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.cards.models import CardInvoice
from src.finance import service as finance_service

DUE_SOON_DAYS = 7
# Quanto para trás o inbox enxerga contas vencidas em aberto. É um inbox, não
# um histórico: uma conta esquecida há mais de um ano não é uma pendência
# acionável, e a janela também limita a expansão de recorrências.
OVERDUE_LOOKBACK_DAYS = 365
# Menor = mais urgente. É o primeiro item da chave de ordenação, então o
# valor nunca atravessa um nível: uma conta a vencer de R$ 5.000 não passa
# na frente de uma conta VENCIDA de R$ 1.000 (o que acontecia quando peso e
# valor eram somados num número só).
URGENCY_RANK = {"bill_overdue": 0, "bill_due": 1, "invoice_review": 2, "invoice_uncategorized": 3}
# Sem prazo (fatura em revisão, item sem categoria) ordena depois de
# qualquer conta com data dentro do mesmo nível.
_NO_DUE_DATE = 10_000


async def get_action_center(user_id: uuid.UUID, db: AsyncSession) -> dict:
    today = date.today()
    items = []

    # 1. Contas a pagar em aberto, vencidas ou vencendo em até DUE_SOON_DAYS.
    # Passa por list_transactions em vez de consultar FinancialTransaction
    # direto: uma despesa recorrente só tem UMA linha real (o template): as
    # ocorrências seguintes existem virtualmente até alguém pagar ou editar.
    # Lendo a tabela crua, uma conta recorrente cujo template já foi pago some
    # do inbox para sempre — justamente a classe de conta que um inbox de
    # vencimentos precisa mostrar. list_transactions já expande a série na
    # janela, pula as ocorrências já materializadas e estima o "pago" de cada
    # ocorrência virtual pelo mesmo critério do resto do app.
    listing = await finance_service.list_transactions(
        user_id,
        db,
        date_from=_as_datetime(today - timedelta(days=OVERDUE_LOOKBACK_DAYS)),
        date_to=_as_datetime(today + timedelta(days=DUE_SOON_DAYS)),
        transaction_type="expense",
        per_page=500,  # inbox, não relatório — teto generoso, sem paginar
    )
    for txn in listing["items"]:
        if txn["is_paid"]:
            continue
        due = txn["due_date"]
        due = due.date() if isinstance(due, datetime) else due
        days_until = (due - today).days
        overdue = days_until < 0
        items.append({
            "id": f"tx:{txn['id']}",
            "kind": "bill_overdue" if overdue else "bill_due",
            "title": txn["description"] or "Conta a pagar",
            "description": f"Venceu há {abs(days_until)} dia(s)" if overdue else (
                "Vence hoje" if days_until == 0 else f"Vence em {days_until} dia(s)"
            ),
            "amount": txn["amount"],
            "due_date": due.isoformat(),
            "href": "/transactions",
            "days_until": days_until,
        })

    # 2. Faturas em revisão (extraídas pela IA, aguardando confirmação) e
    # itens sem categoria dentro delas — cada fatura em revisão gera no
    # máximo 2 itens (a fatura em si + um resumo dos itens sem categoria),
    # nunca um item por lançamento — isso poluiria o inbox.
    inv_result = await db.execute(
        select(CardInvoice)
        .where(CardInvoice.user_id == user_id, CardInvoice.status == "review")
        .options(selectinload(CardInvoice.items))
        .order_by(CardInvoice.created_at.desc())
        .limit(50)
    )
    for invoice in inv_result.scalars().all():
        items.append({
            "id": f"invoice:{invoice.id}",
            "kind": "invoice_review",
            "title": f"Fatura de {invoice.reference_month.strftime('%m/%Y')} aguardando revisão",
            "description": "Extraída por IA — confirme os lançamentos para lançar em Finanças.",
            "amount": invoice.total_amount,
            "due_date": invoice.due_date.isoformat() if invoice.due_date else None,
            "href": "/finances/cards",
            "days_until": None,
        })
        uncategorized = [i for i in invoice.items if not i.is_ignored and not i.category_id]
        if uncategorized:
            total = sum((i.amount for i in uncategorized), Decimal("0"))
            items.append({
                "id": f"invoice-uncat:{invoice.id}",
                "kind": "invoice_uncategorized",
                "title": f"{len(uncategorized)} lançamento(s) sem categoria",
                "description": f"Na fatura de {invoice.reference_month.strftime('%m/%Y')} — categorize antes de confirmar.",
                "amount": total,
                "due_date": None,
                "href": "/finances/cards",
                "days_until": None,
            })

    items.sort(key=_priority_key)
    for item in items:
        item.pop("days_until", None)

    total_amount = sum(
        (i["amount"] or Decimal("0") for i in items if i["kind"] in ("bill_due", "bill_overdue")),
        Decimal("0"),
    )
    return {"items": items, "total_amount": total_amount}


def _as_datetime(day: date) -> datetime:
    """list_transactions compara contra due_date, que é TIMESTAMP com fuso."""
    return datetime.combine(day, time.min, tzinfo=timezone.utc)


def _priority_key(item: dict) -> tuple:
    """Urgência primeiro, prazo depois, valor por último — nessa ordem, e
    nunca somados: só desempata dentro do mesmo nível."""
    days = item.get("days_until")
    return (
        URGENCY_RANK[item["kind"]],
        days if days is not None else _NO_DUE_DATE,
        -float(item["amount"] or 0),
    )
