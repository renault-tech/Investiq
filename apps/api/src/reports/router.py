"""Monthly report API — PDF or Excel, consolidado ou por carteira."""
import uuid
from datetime import date as dt_date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query, Response

from src.database import get_db
from src.auth.dependencies import get_current_user
from src.auth.models import User
from src.market_data.dependencies import get_redis as _get_redis
from src.market_data.dependencies import get_user_provider_settings as _get_user_provider_settings
from src.reports import service
from src.reports.schemas import GeneratedReportResponse
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/reports", tags=["reports"])


def _parse_ids(raw: Optional[str]) -> Optional[list[uuid.UUID]]:
    """IDs separados por vírgula. Vazio = todas, consolidado."""
    if not raw:
        return None
    return [uuid.UUID(part) for part in (p.strip() for p in raw.split(",")) if part]


@router.get("/monthly")
async def get_monthly_report(
    month: str = Query(default_factory=lambda: dt_date.today().strftime("%Y-%m")),
    format: str = Query("pdf", pattern="^(pdf|xlsx)$"),
    account_ids: Optional[str] = Query(None, description="IDs de contas separados por vírgula; vazio = consolidado"),
    portfolio_ids: Optional[str] = Query(None, description="IDs de carteiras de investimento; vazio = todas"),
    include_finance: bool = Query(True, description="Incluir a seção de finanças pessoais"),
    include_investments: bool = Query(
        True,
        description="Incluir a seção de investimentos; False omite a seção inteira",
    ),
    include_charts: bool = Query(True, description="Incluir gráficos"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis=Depends(_get_redis),
    provider_settings: dict = Depends(_get_user_provider_settings),
):
    """Consolidated finance + investments report for a given month."""
    content = await service.generate_monthly_report(
        user_id=current_user.id,
        user_name=current_user.full_name or current_user.email,
        month=month,
        db=db,
        redis=redis,
        preferred_provider=provider_settings["preferred"],
        brapi_key=provider_settings["brapi_key"],
        fmt=format,
        account_ids=_parse_ids(account_ids),
        portfolio_ids=_parse_ids(portfolio_ids),
        include_finance=include_finance,
        include_investments=include_investments,
        include_charts=include_charts,
    )
    media_type, extension = service.FORMATS[format]
    file_name = f"relatorio_{month}.{extension}"
    await service.save_generated_report(
        current_user.id, "monthly_summary", format, {"month": month}, file_name, content, db
    )
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{file_name}"'},
    )


@router.get("/quick/consolidated-statement")
async def quick_consolidated_statement(
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Extrato consolidado — CSV de todas as transações financeiras no período."""
    content = await service.generate_consolidated_statement(current_user.id, date_from, date_to, db)
    file_name = "extrato-consolidado.csv"
    await service.save_generated_report(
        current_user.id, "consolidated_statement", "csv",
        {"date_from": date_from.isoformat() if date_from else None, "date_to": date_to.isoformat() if date_to else None},
        file_name, content, db,
    )
    return Response(
        content=content, media_type=service.CSV_CONTENT_TYPE,
        headers={"Content-Disposition": f'attachment; filename="{file_name}"'},
    )


@router.get("/quick/benchmark-performance")
async def quick_benchmark_performance(
    period: str = Query(default="1y", pattern="^(1m|3m|6m|1y|2y|max)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis=Depends(_get_redis),
    provider_settings: dict = Depends(_get_user_provider_settings),
):
    """Rentabilidade vs benchmarks — CSV da série consolidada vs CDI/Ibovespa/Nasdaq/S&P 500."""
    content = await service.generate_benchmark_report(
        current_user.id, period, db, redis, provider_settings["preferred"], provider_settings["brapi_key"]
    )
    file_name = f"rentabilidade-vs-benchmarks-{period}.csv"
    await service.save_generated_report(
        current_user.id, "benchmark_performance", "csv", {"period": period}, file_name, content, db
    )
    return Response(
        content=content, media_type=service.CSV_CONTENT_TYPE,
        headers={"Content-Disposition": f'attachment; filename="{file_name}"'},
    )


@router.get("/quick/tax-report")
async def quick_tax_report(
    year: int = Query(default_factory=lambda: dt_date.today().year),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Relatório fiscal — CSV combinando apuração mensal, DARF e informe de rendimentos."""
    content = await service.generate_tax_report(current_user.id, year, db)
    file_name = f"relatorio-fiscal-{year}.csv"
    await service.save_generated_report(
        current_user.id, "tax_report", "csv", {"year": year}, file_name, content, db
    )
    return Response(
        content=content, media_type=service.CSV_CONTENT_TYPE,
        headers={"Content-Disposition": f'attachment; filename="{file_name}"'},
    )


@router.get("/generated", response_model=list[GeneratedReportResponse])
async def list_generated_reports(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Histórico de relatórios já gerados (mais recente primeiro)."""
    return await service.list_generated_reports(current_user.id, db)


@router.get("/generated/{report_id}/download")
async def download_generated_report(
    report_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Rebaixa um relatório já gerado, sem recalcular nada."""
    report = await service.get_generated_report(report_id, current_user.id, db)
    content_type = service.CSV_CONTENT_TYPE if report.format == "csv" else service.FORMATS.get(report.format, ("application/octet-stream", ""))[0]
    return Response(
        content=report.file_content, media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{report.file_name}"'},
    )


@router.delete("/generated/{report_id}", status_code=204)
async def delete_generated_report(
    report_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await service.delete_generated_report(report_id, current_user.id, db)
