"""Monthly report assembly — pulls the same data the finance summary and
portfolio summary endpoints already compute, then hands it to the PDF
renderer. No new aggregation logic duplicated here."""
import re
import uuid
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from src.finance.service import get_summary as get_finance_summary
from src.portfolio.service import get_user_portfolios, get_portfolio_summary
from src.reports.pdf_report import generate_monthly_report_pdf
from src.shared.exceptions import ValidationError

_MONTH_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


async def generate_monthly_report(
    user_id: uuid.UUID,
    user_name: str,
    month: str,
    db: AsyncSession,
    redis=None,
    preferred_provider: str = "yahoo",
    brapi_key: Optional[str] = None,
) -> bytes:
    if not _MONTH_RE.match(month):
        raise ValidationError("month deve estar no formato YYYY-MM")

    finance_summary = await get_finance_summary(user_id, month, db)

    portfolios = await get_user_portfolios(user_id, db)
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

    return generate_monthly_report_pdf(
        user_name=user_name,
        month=month,
        finance_summary=finance_summary,
        portfolios=portfolio_summaries,
    )
