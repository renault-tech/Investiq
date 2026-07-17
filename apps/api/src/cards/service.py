"""Card/invoice business logic — CRUD, upload pipeline, review, confirmation."""
import json
import uuid
import logging
from datetime import date, datetime, time, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.cards.models import CreditCard, CardInvoice, InvoiceItem
from src.cards.parser import parse_invoice_file, InvoiceParseError
from src.cards.ai_extractor import extract_invoice_items, InvoiceExtractionError
from src.finance.models import FinanceCategory, FinancialTransaction
from src.finance.service import ensure_default_categories
from src.shared.exceptions import NotFoundError, ConflictError, ValidationError

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Cards CRUD
# ---------------------------------------------------------------------------

async def list_cards(user_id: uuid.UUID, db: AsyncSession) -> list[CreditCard]:
    result = await db.execute(
        select(CreditCard).where(CreditCard.user_id == user_id).order_by(CreditCard.created_at)
    )
    return list(result.scalars().all())


async def get_card(card_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> CreditCard:
    result = await db.execute(
        select(CreditCard).where(CreditCard.id == card_id, CreditCard.user_id == user_id)
    )
    card = result.scalar_one_or_none()
    if not card:
        raise NotFoundError("Cartão não encontrado")
    return card


async def create_card(user_id: uuid.UUID, data: dict, db: AsyncSession) -> CreditCard:
    card = CreditCard(user_id=user_id, **data)
    db.add(card)
    await db.commit()
    await db.refresh(card)
    return card


async def update_card(card_id: uuid.UUID, user_id: uuid.UUID, updates: dict, db: AsyncSession) -> CreditCard:
    card = await get_card(card_id, user_id, db)
    for field, value in updates.items():
        if value is not None:
            setattr(card, field, value)
    await db.commit()
    await db.refresh(card)
    return card


async def delete_card(card_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> None:
    card = await get_card(card_id, user_id, db)
    await db.delete(card)
    await db.commit()


# ---------------------------------------------------------------------------
# Invoice upload pipeline
# ---------------------------------------------------------------------------

async def process_invoice_upload(
    card_id: uuid.UUID,
    user_id: uuid.UUID,
    reference_month: date,
    file_name: str,
    content: bytes,
    provider,                 # LLMProvider (resolved by the router)
    llm_model: Optional[str],
    db: AsyncSession,
) -> CardInvoice:
    """Parse file → LLM extraction → invoice in 'review' (or 'failed') status."""
    await get_card(card_id, user_id, db)
    reference_month = reference_month.replace(day=1)

    existing = await db.execute(
        select(CardInvoice).where(
            CardInvoice.card_id == card_id,
            CardInvoice.reference_month == reference_month,
        )
    )
    if existing.scalar_one_or_none():
        raise ConflictError("Já existe fatura para este cartão neste mês — exclua-a antes de reenviar")

    invoice = CardInvoice(
        user_id=user_id,
        card_id=card_id,
        reference_month=reference_month,
        status="processing",
        file_name=file_name[:255] if file_name else None,
    )
    db.add(invoice)
    await db.flush()

    # 1. Parse do arquivo
    try:
        raw_text = parse_invoice_file(file_name, content)
    except InvoiceParseError as exc:
        invoice.status = "failed"
        invoice.error_message = str(exc)
        await db.commit()
        await db.refresh(invoice)
        return invoice
    invoice.raw_text = raw_text

    # 2. Extração via IA com as categorias de despesa do usuário
    await ensure_default_categories(user_id, db)
    cat_result = await db.execute(
        select(FinanceCategory).where(
            FinanceCategory.user_id == user_id,
            FinanceCategory.category_type == "expense",
            FinanceCategory.is_active.is_(True),
        )
    )
    categories = list(cat_result.scalars().all())
    category_by_name = {c.name.casefold(): c for c in categories}

    try:
        extraction = await extract_invoice_items(
            provider, llm_model, raw_text, [c.name for c in categories]
        )
    except InvoiceExtractionError as exc:
        invoice.status = "failed"
        invoice.error_message = str(exc)
        await db.commit()
        await db.refresh(invoice)
        return invoice

    total = Decimal("0")
    for item in extraction.items:
        suggested = category_by_name.get((item.suggested_category or "").casefold())
        db.add(InvoiceItem(
            user_id=user_id,
            invoice_id=invoice.id,
            description=item.description,
            amount=abs(item.amount),
            purchase_date=item.date,
            installment_no=item.installment_no,
            installment_total=item.installment_total,
            suggested_category_id=suggested.id if suggested else None,
            category_id=suggested.id if suggested else None,
        ))
        total += abs(item.amount)

    invoice.status = "review"
    invoice.total_amount = extraction.total or total
    invoice.due_date = extraction.due_date
    await db.commit()
    await db.refresh(invoice)
    return invoice


# ---------------------------------------------------------------------------
# Invoices / items
# ---------------------------------------------------------------------------

async def list_invoices(card_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> list[CardInvoice]:
    await get_card(card_id, user_id, db)
    result = await db.execute(
        select(CardInvoice)
        .where(CardInvoice.card_id == card_id, CardInvoice.user_id == user_id)
        .order_by(CardInvoice.reference_month.desc())
    )
    return list(result.scalars().all())


async def get_invoice(invoice_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession, *, with_items: bool = True) -> CardInvoice:
    query = select(CardInvoice).where(
        CardInvoice.id == invoice_id, CardInvoice.user_id == user_id
    )
    if with_items:
        query = query.options(selectinload(CardInvoice.items))
    result = await db.execute(query)
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise NotFoundError("Fatura não encontrada")
    return invoice


async def update_invoice_item(
    invoice_id: uuid.UUID,
    item_id: uuid.UUID,
    user_id: uuid.UUID,
    updates: dict,
    db: AsyncSession,
) -> InvoiceItem:
    invoice = await get_invoice(invoice_id, user_id, db, with_items=False)
    if invoice.status == "confirmed":
        raise ConflictError("Fatura já confirmada — itens não podem ser editados")
    result = await db.execute(
        select(InvoiceItem).where(
            InvoiceItem.id == item_id,
            InvoiceItem.invoice_id == invoice_id,
            InvoiceItem.user_id == user_id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise NotFoundError("Item não encontrado")
    for field, value in updates.items():
        setattr(item, field, value)
    await db.commit()
    await db.refresh(item)
    return item


async def confirm_invoice(invoice_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> CardInvoice:
    """Create one expense financial_transaction per non-ignored item (single DB txn).

    Idempotent: a second confirm raises ConflictError (409)."""
    invoice = await get_invoice(invoice_id, user_id, db)
    if invoice.status == "confirmed":
        raise ConflictError("Fatura já confirmada")
    if invoice.status != "review":
        raise ValidationError(f"Fatura em status '{invoice.status}' não pode ser confirmada")

    card = await get_card(invoice.card_id, user_id, db)
    for item in invoice.items:
        if item.is_ignored:
            continue
        txn = FinancialTransaction(
            user_id=user_id,
            category_id=item.category_id or item.suggested_category_id,
            transaction_type="expense",
            amount=item.amount,
            description=f"[{card.name}] {item.description}"[:255],
            transaction_date=datetime.combine(
                item.purchase_date or invoice.due_date or invoice.reference_month,
                time(12, 0),
                tzinfo=timezone.utc,
            ),
            tags=json.dumps(["cartão"]),
        )
        db.add(txn)
        await db.flush()
        item.financial_transaction_id = txn.id

    invoice.status = "confirmed"
    await db.commit()
    await db.refresh(invoice)
    return invoice


async def delete_invoice(invoice_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> None:
    invoice = await get_invoice(invoice_id, user_id, db, with_items=False)
    if invoice.status == "confirmed":
        raise ConflictError("Fatura confirmada não pode ser excluída")
    await db.delete(invoice)
    await db.commit()
