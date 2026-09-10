"""Central de Ações — agrega pendências que já existem em Finanças e Cartões
num único inbox priorizado, sem tabela nova: nada aqui é fonte de verdade,
é leitura computada sob demanda (mesma filosofia de cards/analytics.py).

Prioridade = (urgência de prazo, impacto financeiro). Vencida > vence em
≤3 dias > vence em ≤7 dias > fatura em revisão (sem prazo definido) > item
sem categoria (o mais baixo — não é urgente, é higiene de dados). Dentro do
mesmo nível de urgência, maior valor primeiro — R$ 4.000 vencendo essa
semana pesa mais que R$ 40, mesmo prazo.
"""
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.cards.models import CardInvoice, InvoiceItem
from src.finance.models import FinancialTransaction

DUE_SOON_DAYS = 7
URGENCY_WEIGHT = {"bill_overdue": 3000, "bill_due": 2000, "invoice_review": 1000, "invoice_uncategorized": 0}


async def get_action_center(user_id: uuid.UUID, db: AsyncSession) -> dict:
    today = date.today()
    items = []

    # 1. Contas a pagar em aberto, vencidas ou vencendo em até DUE_SOON_DAYS.
    tx_result = await db.execute(
        select(FinancialTransaction)
        .where(
            FinancialTransaction.user_id == user_id,
            FinancialTransaction.deleted_at.is_(None),
            FinancialTransaction.transaction_type == "expense",
            FinancialTransaction.is_paid.is_(False),
        )
        .order_by(FinancialTransaction.due_date)
        .limit(200)  # inbox, não relatório — não precisa do histórico inteiro
    )
    for txn in tx_result.scalars().all():
        due = txn.due_date.date() if isinstance(txn.due_date, datetime) else txn.due_date
        days_until = (due - today).days
        if days_until > DUE_SOON_DAYS:
            continue
        overdue = days_until < 0
        items.append({
            "id": f"tx:{txn.id}",
            "kind": "bill_overdue" if overdue else "bill_due",
            "title": txn.description or "Conta a pagar",
            "description": f"Venceu há {abs(days_until)} dia(s)" if overdue else (
                "Vence hoje" if days_until == 0 else f"Vence em {days_until} dia(s)"
            ),
            "amount": txn.amount,
            "due_date": due.isoformat(),
            "href": "/transactions",
            "priority_score": URGENCY_WEIGHT["bill_overdue" if overdue else "bill_due"] + float(txn.amount),
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
            "priority_score": URGENCY_WEIGHT["invoice_review"] + float(invoice.total_amount or 0),
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
                "priority_score": URGENCY_WEIGHT["invoice_uncategorized"] + float(total),
            })

    items.sort(key=lambda i: i["priority_score"], reverse=True)
    total_amount = sum((i["amount"] or Decimal("0") for i in items if i["kind"] in ("bill_due", "bill_overdue")), Decimal("0"))
    return {"items": items, "total_amount": total_amount}
