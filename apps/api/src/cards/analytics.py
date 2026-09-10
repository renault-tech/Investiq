"""Analytics de fatura — breakdown por categoria, tendência e achados.

Leitura pura, sem mutação, por isso vive fora de service.py (que já carrega
300+ linhas de CRUD e do pipeline de importação): dá para testar sem tocar em
nada que grave. Tudo é calculado sob demanda a partir das faturas já
importadas — nenhuma tabela nova.
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
# Abaixo disso não dá para falar em desvio de padrão — uma fatura só de
# histórico faz qualquer variação parecer um estouro.
MIN_HISTORY_FOR_SPIKE = 2
# Faturas que de fato têm dado. Um upload que falhou fica gravado como
# 'failed' (service.py marca a linha já criada), sem itens e sem total, e
# 'processing' é o estado intermediário — incluir qualquer um dos dois
# desenha uma barra zerada na tendência e, pior, conta como histórico:
# uma categoria com uma única fatura anterior utilizável passaria o piso do
# spike e geraria um achado falso.
USABLE_STATUSES = ("review", "confirmed")


async def get_invoice_analytics(invoice_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> dict:
    invoice = await _get_invoice_with_items(invoice_id, user_id, db)

    history_result = await db.execute(
        select(CardInvoice)
        .where(
            CardInvoice.card_id == invoice.card_id,
            CardInvoice.user_id == user_id,
            CardInvoice.reference_month < invoice.reference_month,
            CardInvoice.status.in_(USABLE_STATUSES),
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
    # Agregado uma vez e passado adiante: breakdown e achados precisam
    # exatamente do mesmo número, e recalcular varreria todo o histórico
    # duas vezes.
    current_by_cat = _totals_by_category(active_items)
    hist_by_cat = _history_totals_by_category(history)

    return {
        "invoice_id": invoice.id,
        "category_breakdown": _category_breakdown(current_by_cat, hist_by_cat, category_name),
        "trend": [
            {"reference_month": inv.reference_month, "total_amount": inv.total_amount or Decimal("0")}
            for inv in history + [invoice]
        ],
        "avg_amount": _avg([inv.total_amount for inv in history] or [invoice.total_amount or Decimal("0")]),
        "top_items": sorted(active_items, key=lambda i: i.amount, reverse=True)[:TOP_ITEMS],
        "findings": _findings(active_items, current_by_cat, hist_by_cat, category_name, len(history)),
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


def _totals_by_category(items: list[InvoiceItem]) -> dict[Optional[uuid.UUID], Decimal]:
    totals: dict[Optional[uuid.UUID], Decimal] = defaultdict(lambda: Decimal("0"))
    for item in items:
        if not item.is_ignored:
            totals[item.category_id] += item.amount
    return totals


def _history_totals_by_category(history: list[CardInvoice]) -> dict[Optional[uuid.UUID], list[Decimal]]:
    """Uma entrada por fatura em que a categoria apareceu. Categoria ausente
    numa fatura antiga não vira zero — senão uma categoria criada mês passado
    puxaria a própria média para baixo e pareceria estar sempre estourando."""
    by_cat: dict[Optional[uuid.UUID], list[Decimal]] = defaultdict(list)
    for inv in history:
        for cat_id, total in _totals_by_category(inv.items).items():
            by_cat[cat_id].append(total)
    return by_cat


def _category_breakdown(
    current_by_cat: dict[Optional[uuid.UUID], Decimal],
    hist_by_cat: dict[Optional[uuid.UUID], list[Decimal]],
    category_name: dict,
) -> list[dict]:
    slices = []
    for cat_id, amount in sorted(current_by_cat.items(), key=lambda kv: kv[1], reverse=True):
        hist_avg = _avg(hist_by_cat.get(cat_id, []))
        slices.append({
            "category_id": cat_id,
            "category": category_name.get(cat_id, "Sem categoria"),
            "amount": amount,
            # None = sem histórico com que comparar; a UI mostra "—" em vez
            # de fingir uma variação de 0%.
            "delta_pct": ((amount - hist_avg) / hist_avg * 100) if hist_avg > 0 else None,
        })
    return slices


def _findings(
    active_items: list[InvoiceItem],
    current_by_cat: dict[Optional[uuid.UUID], Decimal],
    hist_by_cat: dict[Optional[uuid.UUID], list[Decimal]],
    category_name: dict,
    history_count: int,
) -> list[dict]:
    findings = []

    # Duplicidade: mesma descrição + valor + data de compra dentro da MESMA
    # fatura — dupla captura do lado do banco/maquininha, não parcela (que
    # tem installment_no diferente) nem recorrência normal (mês diferente).
    # Conta as ocorrências antes de relatar: três cobranças iguais são um
    # achado de três, não dois achados separados.
    # purchase_date é obrigatório na chave: o extrator admite não conseguir
    # identificar a data, e sem ela dois lançamentos sem relação nenhuma (só
    # com mesma descrição e valor) cairiam no mesmo grupo e seriam acusados
    # de acontecer "no mesmo dia" — que é justamente o que não se sabe.
    groups: dict[tuple, list[InvoiceItem]] = defaultdict(list)
    for item in active_items:
        if item.installment_no is None and item.purchase_date is not None:
            groups[(item.description.strip().casefold(), item.amount, item.purchase_date)].append(item)
    for repeated in groups.values():
        if len(repeated) < 2:
            continue
        first = repeated[0]
        findings.append({
            "kind": "duplicate",
            "title": "Cobrança duplicada",
            "description": (
                f'"{first.description}" aparece {len(repeated)} vezes no mesmo dia, mesmo valor.'
            ),
            "amount": first.amount * (len(repeated) - 1),
        })

    # Categoria estourou: total atual > SPIKE_MULTIPLIER x a média das
    # faturas anteriores na mesma categoria.
    if history_count >= MIN_HISTORY_FOR_SPIKE:
        for cat_id, amount in current_by_cat.items():
            hist_avg = _avg(hist_by_cat.get(cat_id, []))
            if hist_avg > 0 and amount > hist_avg * SPIKE_MULTIPLIER:
                findings.append({
                    "kind": "category_spike",
                    "title": f"{category_name.get(cat_id, 'Sem categoria')} acima do normal",
                    "description": (
                        f"Esta fatura está {(amount / hist_avg):.1f}x a média das anteriores."
                    ),
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
