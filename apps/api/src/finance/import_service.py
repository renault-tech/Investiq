"""Importação de extrato: upload → deduplicação → revisão → confirmação.

Persistido em tabela, não em memória — upload e confirmação são duas
requisições HTTP separadas, e em ambiente serverless nada garante que caiam
na mesma instância.
"""
import uuid
from datetime import timedelta
from decimal import Decimal
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.finance import service as finance_service
from src.finance.import_models import FinanceImportBatch, FinanceImportRow
from src.finance.import_parsers import ParsedRow, description_similarity, parse_csv, parse_ofx
from src.finance.models import FinancialTransaction
from src.shared.exceptions import ConflictError, NotFoundError, ValidationError

_SIMILARITY_THRESHOLD = 0.35


def parse_statement(file_name: str, content: bytes) -> tuple[str, list[ParsedRow]]:
    """Detecta o tipo pelo conteúdo (OFX tem a tag <OFX>), não só pela
    extensão — o nome do arquivo é informação do usuário, não confiável."""
    text = content.decode("utf-8-sig", errors="replace")
    if "<OFX" in text.upper()[:2000] or file_name.lower().endswith(".ofx"):
        return "ofx", parse_ofx(text)
    if file_name.lower().endswith((".csv", ".txt")):
        return "csv", parse_csv(text)
    raise ValidationError("Formato não reconhecido — envie um arquivo .ofx ou .csv")


async def _find_duplicates(
    user_id: uuid.UUID,
    bank_account_id: Optional[uuid.UUID],
    rows: list[ParsedRow],
    db: AsyncSession,
) -> dict[int, FinancialTransaction]:
    """Uma query para o lote inteiro, não uma por linha: nível 1 (FITID
    idêntico) é dedupe certo; nível 2 (mesmo valor, data próxima, descrição
    parecida) é dedupe provável — a revisão decide, por isso vem desmarcado
    mas não bloqueado."""
    if not rows:
        return {}
    min_date = min(r.transaction_date for r in rows) - timedelta(days=3)
    max_date = max(r.transaction_date for r in rows) + timedelta(days=3)

    query = select(FinancialTransaction).where(
        FinancialTransaction.user_id == user_id,
        FinancialTransaction.deleted_at.is_(None),
        FinancialTransaction.transaction_date >= min_date,
        FinancialTransaction.transaction_date <= max_date,
    )
    if bank_account_id:
        query = query.where(FinancialTransaction.bank_account_id == bank_account_id)
    candidates = list((await db.execute(query)).scalars().all())

    matches: dict[int, FinancialTransaction] = {}
    for index, row in enumerate(rows):
        if row.external_id:
            exact = next((c for c in candidates if c.external_id == row.external_id), None)
            if exact:
                matches[index] = exact
                continue
        for candidate in candidates:
            if candidate.transaction_type != row.transaction_type:
                continue
            if candidate.amount != row.amount:
                continue
            if abs((candidate.transaction_date - row.transaction_date).days) > 3:
                continue
            similar = description_similarity(candidate.description or "", row.description)
            if similar >= _SIMILARITY_THRESHOLD or not candidate.description:
                matches[index] = candidate
                break
    return matches


def _row_to_dict(row: FinanceImportRow) -> dict:
    return {
        "id": row.id,
        "transaction_date": row.transaction_date,
        "amount": row.amount,
        "transaction_type": row.transaction_type,
        "description": row.description,
        "external_id": row.external_id,
        "category_id": row.category_id,
        "category_name": row.category.name if row.category else None,
        "is_duplicate": row.is_duplicate,
        "duplicate_transaction_id": row.duplicate_transaction_id,
        "is_selected": row.is_selected,
    }


def _batch_to_dict(batch: FinanceImportBatch) -> dict:
    return {
        "id": batch.id,
        "bank_account_id": batch.bank_account_id,
        "file_name": batch.file_name,
        "file_type": batch.file_type,
        "status": batch.status,
        "rows": [_row_to_dict(r) for r in batch.rows],
    }


async def create_import_batch_from_content(
    user_id: uuid.UUID,
    db: AsyncSession,
    *,
    file_name: str,
    content: bytes,
    bank_account_id: Optional[uuid.UUID],
) -> dict:
    if bank_account_id:
        await finance_service._validate_account(bank_account_id, user_id, db)

    file_type, rows = parse_statement(file_name, content)
    if len(rows) > 2000:
        raise ValidationError("Arquivo com mais de 2000 transações — divida em partes menores")

    duplicates = await _find_duplicates(user_id, bank_account_id, rows, db)

    batch = FinanceImportBatch(
        user_id=user_id, bank_account_id=bank_account_id,
        file_name=file_name[:255], file_type=file_type, status="pending",
    )
    db.add(batch)
    await db.flush()

    for index, row in enumerate(rows):
        duplicate = duplicates.get(index)
        db.add(FinanceImportRow(
            batch_id=batch.id, user_id=user_id,
            transaction_date=row.transaction_date, amount=row.amount,
            transaction_type=row.transaction_type, description=row.description[:255],
            external_id=row.external_id,
            is_duplicate=duplicate is not None,
            duplicate_transaction_id=duplicate.id if duplicate else None,
            # Duplicata provável vem desmarcada — o usuário decide se quer
            # mesmo assim; duplicata exata (mesmo FITID) também, mas nesse
            # caso é quase certo que confirmar criaria um lançamento repetido.
            is_selected=duplicate is None,
        ))

    await db.commit()
    return await get_import_batch(batch.id, user_id, db)


async def _get_batch(batch_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> FinanceImportBatch:
    result = await db.execute(
        select(FinanceImportBatch)
        .options(selectinload(FinanceImportBatch.rows).selectinload(FinanceImportRow.category))
        .where(FinanceImportBatch.id == batch_id, FinanceImportBatch.user_id == user_id)
    )
    batch = result.scalar_one_or_none()
    if not batch:
        raise NotFoundError("Lote de importação não encontrado")
    return batch


async def get_import_batch(batch_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> dict:
    batch = await _get_batch(batch_id, user_id, db)
    return _batch_to_dict(batch)


async def update_import_row(
    row_id: uuid.UUID, user_id: uuid.UUID, updates: dict, db: AsyncSession
) -> dict:
    result = await db.execute(
        select(FinanceImportRow)
        .options(selectinload(FinanceImportRow.category))
        .join(FinanceImportBatch, FinanceImportRow.batch_id == FinanceImportBatch.id)
        .where(FinanceImportRow.id == row_id, FinanceImportRow.user_id == user_id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise NotFoundError("Linha de importação não encontrada")
    if updates.get("category_id"):
        await finance_service._get_category(updates["category_id"], user_id, db)
    for field, value in updates.items():
        if value is not None:
            setattr(row, field, value)
    await db.commit()
    await db.refresh(row, attribute_names=["category"])
    return _row_to_dict(row)


async def confirm_import_batch(batch_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> dict:
    """Grava direto, sem passar por create_transaction: a conta e as
    categorias já foram validadas no upload e na revisão, e um lote pode ter
    até 2000 linhas — validar de novo por linha custaria 2000 queries extras.
    Mesmo trade-off que cards.confirm_invoice: notificação de orçamento
    estourado não dispara para lançamentos em lote."""
    batch = await _get_batch(batch_id, user_id, db)
    if batch.status == "confirmed":
        raise ConflictError("Lote já confirmado")
    if batch.status != "pending":
        raise ValidationError(f"Lote em status '{batch.status}' não pode ser confirmado")

    # Se o usuário forçar a seleção de uma duplicata exata (mesmo FITID já
    # gravado por outro lote), o INSERT bateria no índice único
    # (user_id, external_id). Melhor pular com clareza do que estourar um
    # erro de integridade cru.
    external_ids = {r.external_id for r in batch.rows if r.is_selected and r.external_id}
    already_used: set[str] = set()
    if external_ids:
        existing = await db.execute(
            select(FinancialTransaction.external_id).where(
                FinancialTransaction.user_id == user_id,
                FinancialTransaction.external_id.in_(external_ids),
                FinancialTransaction.deleted_at.is_(None),
            )
        )
        already_used = {row[0] for row in existing.all()}

    source = f"import_{batch.file_type}"
    created = 0
    skipped = 0
    for row in batch.rows:
        if not row.is_selected or (row.external_id and row.external_id in already_used):
            skipped += 1
            continue
        txn = FinancialTransaction(
            user_id=user_id,
            transaction_type=row.transaction_type,
            amount=row.amount,
            amount_brl=row.amount,  # extrato bancário é sempre BRL
            description=row.description,
            category_id=row.category_id,
            bank_account_id=batch.bank_account_id,
            transaction_date=row.transaction_date,
            source=source,
            external_id=row.external_id,
        )
        db.add(txn)
        await db.flush()
        row.created_transaction_id = txn.id
        created += 1

    batch.status = "confirmed"
    await db.commit()
    return {"created": created, "skipped": skipped}


async def discard_import_batch(batch_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> None:
    batch = await _get_batch(batch_id, user_id, db)
    if batch.status == "confirmed":
        raise ValidationError("Lote já confirmado não pode ser descartado")
    await db.delete(batch)
    await db.commit()
