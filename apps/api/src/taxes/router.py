"""Impostos & IR — apuração de ganho de capital, DARF e informe de rendimentos."""
from datetime import date as dt_date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.auth.dependencies import get_current_user
from src.auth.models import User
from src.taxes import service
from src.taxes.schemas import TaxApurationResponse, DarfResponse, InformeRendimentosResponse

router = APIRouter(prefix="/taxes", tags=["taxes"])


@router.get("/apuracao", response_model=TaxApurationResponse)
async def get_apuracao(
    year: int = Query(default_factory=lambda: dt_date.today().year),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_apuration(current_user.id, year, db)


@router.get("/darf", response_model=DarfResponse)
async def get_darf(
    year: int = Query(default_factory=lambda: dt_date.today().year),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_darf_list(current_user.id, year, db)


@router.get("/informe", response_model=InformeRendimentosResponse)
async def get_informe(
    year: int = Query(default_factory=lambda: dt_date.today().year),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_informe(current_user.id, year, db)
