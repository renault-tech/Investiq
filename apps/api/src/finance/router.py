"""Finance API router — categories + transactions + summary."""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.auth.dependencies import get_current_user
from src.auth.models import User
from src.finance import service
from src.finance.schemas import (
    CategoryCreate, CategoryResponse,
    TransactionCreate, TransactionUpdate, TransactionResponse,
    FinanceSummaryResponse,
)

router = APIRouter(prefix="/finance", tags=["finance"])


@router.get("/categories", response_model=list[CategoryResponse])
async def list_categories(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_categories(current_user.id, db)


@router.post("/categories", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    body: CategoryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.create_category(current_user.id, body, db)


@router.get("/summary", response_model=FinanceSummaryResponse)
async def get_summary(
    year: int = Query(default_factory=lambda: datetime.now().year),
    month: int = Query(default_factory=lambda: datetime.now().month),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_summary(current_user.id, year, month, db)


@router.get("/transactions", response_model=list[TransactionResponse])
async def list_transactions(
    year: int = Query(default_factory=lambda: datetime.now().year),
    month: int = Query(default_factory=lambda: datetime.now().month),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_transactions(current_user.id, year, month, db)


@router.post("/transactions", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    body: TransactionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.create_transaction(current_user.id, body, db)


@router.put("/transactions/{tx_id}", response_model=TransactionResponse)
async def update_transaction(
    tx_id: uuid.UUID,
    body: TransactionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.update_transaction(tx_id, current_user.id, body, db)


@router.delete("/transactions/{tx_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    tx_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await service.delete_transaction(tx_id, current_user.id, db)
