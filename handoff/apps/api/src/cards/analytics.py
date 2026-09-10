"""Analytics de fatura — breakdown por categoria, tendência e achados.

Novo módulo (não existia). Importar em service.py ou chamar direto do router;
mantido separado de service.py (que já tem 300+ linhas de CRUD/pipeline) porque
é leitura pura, sem mutação — mais fácil de testar isolado.
"""
import uuid
from collections import defaultdict
from decimal import Decimal
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.cards.models import CardInvoice, InvoiceItem
from src.finance.models import FinanceCategory
from src.shared.exceptions import NotFoundError

TREND_MONTHS = 6
TOP_ITEMS = 5
# Categoria "estourou" se o total atual passar disso vezes a média das
# faturas anteriores na mesma categoria — 1.4x é deliberadamente alto: ruído
# normal de fatura (uma viagem, uma compra grande) não deveria disparar toda
# hora; o achado é para desvio real de padrão.
SPIKE_MULTIPLIER = Decimal("1.4")


async def get_invoice_analytics(invoice_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> dict:
    invoice = await _get_invoice_with_items(invoice_id, user_id, db)

    history_result = await db.execute(
        select(CardInvoice)
        .where(
            CardInvoice.card_id == invoice.card_id,
            CardInvoice.user_id == user_id,
            CardInvoice.reference_month < invoice.reference_month,
        )
        .options(selectinload(CardInvoice.items))
        .order_by(CardInvoice.reference_month.desc())
        .limit(TREND_MONTHS - 1)
    )
    history = list(history_result.scalars().all())[::-1]  # mais antiga primeiro

    cat_result = await db.execute(
        select(FinanceCategory).where(FinanceCategory.user_id == user_id)
    )
    category_name = {c.id: c.name for c in cat_result.scalars().all()}

    active_items = [i for i in invoice.items if not i.is_ignored]

    return {
        "invoice_id": invoice.id,
        "category_breakdown": _category_breakdown(active_items, history, category_name),
        "trend": [
            {"reference_month": inv.reference_month, "total_amount": inv.total_amount or Decimal("0")}
            for inv in history + [invoice]
        ],
        "avg_amount": _avg([inv.total_amount for inv in history] or [invoice.total_amount or Decimal("0")]),
        "top_items": sorted(active_items, key=lambda i: i.amount, reverse=True)[:TOP_ITEMS],
        "findings": _findings(active_items, history, category_name),
    }


async def _get_invoice_with_items(invoice_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> CardInvoice:
    result = await db.execute(
        select(CardInvoice)
        .where(CardInvoice.id == invoice_id, CardInvoice.user_id == user_id)
        .options(selectinload(CardInvoice.items))
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise NotFoundError("Fatura não encontrada")
    return invoice


def _avg(values: list[Decimal]) -> Decimal:
    values = [v for v in values if v is not None]
    return sum(values) / len(values) if values else Decimal("0")


def _category_breakdown(
    active_items: list[InvoiceItem], history: list[CardInvoice], category_name: dict
) -> list[dict]:
    current_by_cat: dict[Optional[uuid.UUID], Decimal] = defaultdict(lambda: Decimal("0"))
    for item in active_items:
        current_by_cat[item.category_id] += item.amount

    # Média histórica por categoria, para calcular delta % — mesma categoria
    # pode não existir em toda fatura anterior (categoria nova), então usa só
    # as ocorrências que existirem, não preenche com zero.
    hist_by_cat: dict[Optional[uuid.UUID], list[Decimal]] = defaultdict(list)
    for inv in history:
        per_invoice: dict[Optional[uuid.UUID], Decimal] = defaultdict(lambda: Decimal("0"))
        for item in inv.items:
            if not item.is_ignored:
                per_invoice[item.category_id] += item.amount
        for cat_id, total in per_invoice.items():
            hist_by_cat[cat_id].append(total)

    slices = []
    for cat_id, amount in sorted(current_by_cat.items(), key=lambda kv: kv[1], reverse=True):
        hist_avg = _avg(hist_by_cat.get(cat_id, []))
        delta_pct = ((amount - hist_avg) / hist_avg * 100) if hist_avg > 0 else None
        slices.append({
            "category_id": cat_id,
            "category": category_name.get(cat_id, "Sem categoria"),
            "amount": amount,
            "delta_pct": delta_pct,
        })
    return slices


def _findings(active_items: list[InvoiceItem], history: list[CardInvoice], category_name: dict) -> list[dict]:
    findings = []

    # Duplicidade: mesma descrição + valor + data de compra dentro da MESMA
    # fatura — dupla captura do lado do banco/maquininha, não parcela (que
    # tem installment_no diferente) nem recorrência normal (mês diferente).
    seen: dict[tuple, InvoiceItem] = {}
    for item in active_items:
        key = (item.description.strip().casefold(), item.amount, item.purchase_date)
        if key in seen and item.installment_no is None:
            findings.append({
                "kind": "duplicate",
                "title": "Cobrança duplicada",
                "description": f'"{item.description}" aparece duas vezes no mesmo dia, mesmo valor.',
                "amount": item.amount,
            })
        else:
            seen[key] = item

    # Categoria estourou: total atual > SPIKE_MULTIPLIER x a média das
    # faturas anteriores na mesma categoria — só dispara com pelo menos 2
    # faturas de histórico, pra não reagir a ruído de fatura nova.
    if len(history) >= 2:
        current_by_cat: dict[Optional[uuid.UUID], Decimal] = defaultdict(lambda: Decimal("0"))
        for item in active_items:
            current_by_cat[item.category_id] += item.amount
        hist_by_cat: dict[Optional[uuid.UUID], list[Decimal]] = defaultdict(list)
        for inv in history:
            per_invoice: dict[Optional[uuid.UUID], Decimal] = defaultdict(lambda: Decimal("0"))
            for item in inv.items:
                if not item.is_ignored:
                    per_invoice[item.category_id] += item.amount
            for cat_id, total in per_invoice.items():
                hist_by_cat[cat_id].append(total)
        for cat_id, amount in current_by_cat.items():
            hist_avg = _avg(hist_by_cat.get(cat_id, []))
            if hist_avg > 0 and amount > hist_avg * SPIKE_MULTIPLIER:
                findings.append({
                    "kind": "category_spike",
                    "title": f"{category_name.get(cat_id, 'Categoria')} acima do normal",
                    "description": f"Média das faturas anteriores é bem menor — esta fatura está {(amount / hist_avg):.1f}x a média.",
                    "amount": amount,
                })

    # Sem categoria: item que a IA não conseguiu sugerir nem foi corrigido —
    # some da fatura sem virar transação categorizada em Finanças.
    uncategorized = [i for i in active_items if not i.category_id]
    if uncategorized:
        findings.append({
            "kind": "uncategorized",
            "title": f"{len(uncategorized)} lançamento(s) sem categoria",
            "description": "Categorize antes de confirmar — sem categoria, o gasto não entra nos relatórios por categoria.",
            "amount": sum((i.amount for i in uncategorized), Decimal("0")),
        })

    return findings
