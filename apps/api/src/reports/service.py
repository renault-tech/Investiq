"""Monthly report assembly — pulls the same data the finance summary and
portfolio summary endpoints already compute, then hands it to the PDF or
XLSX renderer. No new aggregation logic duplicated here."""
import re
import uuid
from typing import Optional, Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from src.finance.service import get_summary as get_finance_summary, list_accounts
from src.portfolio.service import get_user_portfolios, get_portfolio_summary
from src.reports.pdf_report import generate_monthly_report_pdf
from src.reports.xlsx_report import generate_monthly_report_xlsx
from src.shared.exceptions import ValidationError

_MONTH_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")

FORMATS = {
    "pdf": ("application/pdf", "pdf"),
    "xlsx": ("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"),
}


async def _finance_sections(
    user_id: uuid.UUID,
    month: str,
    db: AsyncSession,
    account_ids: Optional[Sequence[uuid.UUID]],
) -> list[tuple[str, dict]]:
    """Uma seção por carteira escolhida — ou uma só, consolidada, quando
    nenhuma foi. Consolidar sempre esconderia justamente a comparação entre
    carteiras que motiva escolhê-las."""
    if not account_ids:
        return [("Consolidado", await get_finance_summary(user_id, month, db))]

    accounts = {a["id"]: a for a in await list_accounts(user_id, db, include_inactive=True)}
    unknown = [str(a) for a in account_ids if a not in accounts]
    if unknown:
        raise ValidationError(f"Carteira não encontrada: {', '.join(unknown)}")

    return [
        (accounts[account_id]["name"], await get_finance_summary(user_id, month, db, account_id=account_id))
        for account_id in account_ids
    ]


async def generate_monthly_report(
    user_id: uuid.UUID,
    user_name: str,
    month: str,
    db: AsyncSession,
    redis=None,
    preferred_provider: str = "yahoo",
    brapi_key: Optional[str] = None,
    fmt: str = "pdf",
    account_ids: Optional[Sequence[uuid.UUID]] = None,
    portfolio_ids: Optional[Sequence[uuid.UUID]] = None,
) -> bytes:
    if not _MONTH_RE.match(month):
        raise ValidationError("month deve estar no formato YYYY-MM")
    if fmt not in FORMATS:
        raise ValidationError(f"format deve ser um de: {', '.join(FORMATS)}")

    finance_sections = await _finance_sections(user_id, month, db, account_ids)

    portfolios = await get_user_portfolios(user_id, db)
    if portfolio_ids:
        wanted = set(portfolio_ids)
        unknown = wanted - {p.id for p in portfolios}
        if unknown:
            raise ValidationError(
                f"Carteira de investimentos não encontrada: {', '.join(str(p) for p in unknown)}"
            )
        portfolios = [p for p in portfolios if p.id in wanted]

    portfolio_summaries = [
        await get_portfolio_summary(
            portfolio_id=p.id,
            user_id=user_id,
            db=db,
            redis=redis,
            preferred_provider=preferred_provider,
            brapi_key=brapi_key,
        )
        for p in portfolios
    ]

    if fmt == "xlsx":
        return generate_monthly_report_xlsx(
            user_name=user_name,
            month=month,
            finance_sections=finance_sections,
            portfolios=portfolio_summaries,
        )
    return generate_monthly_report_pdf(
        user_name=user_name,
        month=month,
        finance_sections=finance_sections,
        portfolios=portfolio_summaries,
    )
