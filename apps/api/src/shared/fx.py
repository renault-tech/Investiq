"""Conversão de moeda para BRL — usado por portfolio (posições) e finance
(transações) para não duplicar a mesma lógica de fallback."""
import logging
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.portfolio.models import FxRate

logger = logging.getLogger(__name__)

_ONE = Decimal("1")


async def get_fx_rates_to_brl(currencies: set[str], db: AsyncSession) -> dict[str, Decimal]:
    """Latest known rate to BRL for each currency (BRL itself maps to 1).

    Reads the fx_rates table populated daily by workers/fx_updater.py.
    Missing/stale rates degrade to 1:1 (logged) rather than breaking the
    caller — the same posture as a missing live quote elsewhere in the app.
    """
    rates = {"BRL": _ONE}
    needed = currencies - {"BRL"}
    if not needed:
        return rates

    result = await db.execute(
        select(FxRate)
        .where(FxRate.from_currency.in_(needed), FxRate.to_currency == "BRL")
        .order_by(FxRate.date.desc())
    )
    for row in result.scalars().all():
        rates.setdefault(row.from_currency, row.rate)  # first hit per currency = most recent

    for currency in needed - rates.keys():
        logger.warning("No fx_rates row for %s->BRL; using 1:1 as a fallback", currency)
        rates[currency] = _ONE

    return rates
