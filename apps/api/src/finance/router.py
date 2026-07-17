"""Finance API router — categories, transactions, monthly summary."""
import re
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.auth.dependencies import get_current_user
from src.auth.models import User
from src.finance import service
from src.finance.schemas import (
    CategoryCreate,
    CategoryUpdate,
    CategoryResponse,
    TransactionCreate,
    TransactionUpdate,
    TransactionResponse,
    TransactionListResponse,
    FinanceSummaryResponse,
)

router = APIRouter(prefix="/finance", tags=["finance"])

_MONTH_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


# ---------------------------------------------------------------------------
# Categories
# ---------------------------------------------------------------------------

@router.get("/categories", response_model=list[CategoryResponse])
async def list_categories(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List the user's categories (seeds PT-BR defaults on first access)."""
    return await service.list_categories(current_user.id, db)


@router.post("/categories", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    body: CategoryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.create_category(
        current_user.id, body.name, body.category_type, body.color, body.icon, db
    )


@router.patch("/categories/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: uuid.UUID,
    body: CategoryUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.update_category(
        category_id, current_user.id, body.model_dump(exclude_unset=True), db
    )


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await service.delete_category(category_id, current_user.id, db)


# ---------------------------------------------------------------------------
# Transactions
# ---------------------------------------------------------------------------

@router.get("/transactions", response_model=TransactionListResponse)
async def list_transactions(
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    category_id: Optional[uuid.UUID] = None,
    transaction_type: Optional[str] = Query(None, pattern="^(income|expense|transfer)$"),
    search: Optional[str] = Query(None, max_length=100),
    tag: Optional[str] = Query(None, max_length=50),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Filtered listing; recurring templates expand as virtual occurrences in the window."""
    return await service.list_transactions(
        current_user.id, db,
        date_from=date_from, date_to=date_to,
        category_id=category_id, transaction_type=transaction_type,
        search=search, tag=tag, page=page, per_page=per_page,
    )


@router.post("/transactions", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    body: TransactionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.create_transaction(current_user.id, body.model_dump(), db)


@router.patch("/transactions/{txn_id}", response_model=TransactionResponse)
async def update_transaction(
    txn_id: uuid.UUID,
    body: TransactionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.update_transaction(
        txn_id, current_user.id, body.model_dump(exclude_unset=True), db
    )


@router.delete("/transactions/{txn_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    txn_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await service.delete_transaction(txn_id, current_user.id, db)


# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

@router.get("/summary", response_model=FinanceSummaryResponse)
async def get_summary(
    month: str = Query(..., description="YYYY-MM"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not _MONTH_RE.match(month):
        raise HTTPException(status_code=422, detail="month deve estar no formato YYYY-MM")
    return await service.get_summary(current_user.id, month, db)
