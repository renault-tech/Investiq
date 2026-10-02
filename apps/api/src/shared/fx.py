"""Conversão de moeda para BRL — usado por portfolio (posições) e finance
(transações) para não duplicar a mesma lógica de fallback."""
import asyncio
import logging
import time
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.portfolio.models import FxRate

logger = logging.getLogger(__name__)

_ONE = Decimal("1")

# Cotação ao vivo por moeda, guardada no processo: o fallback só existe para
# quando a tabela fx_rates ainda não foi populada (o job diário não rodou) —
# perguntar ao Yahoo a cada request repetiria segundos de rede à toa.
_LIVE_TTL_S = 3600
_LIVE_MISS_TTL_S = 300
_LIVE_TIMEOUT_S = 5.0
_live_cache: dict[str, tuple[float, Decimal | None]] = {}


async def _live_rates_to_brl(currencies: set[str]) -> dict[str, Decimal]:
    """Cotação spot {MOEDA}BRL=X — usada só quando o banco não tem nenhuma."""
    now = time.monotonic()
    found: dict[str, Decimal] = {}
    to_fetch: list[str] = []
    for currency in currencies:
        cached = _live_cache.get(currency)
        if cached and now - cached[0] < (_LIVE_TTL_S if cached[1] else _LIVE_MISS_TTL_S):
            if cached[1]:
                found[currency] = cached[1]
        else:
            to_fetch.append(currency)
    if not to_fetch:
        return found

    from src.market_data.yahoo import YahooFinanceProvider  # import tardio: yfinance é pesado

    symbols = {f"{c}BRL=X": c for c in to_fetch}
    try:
        quotes = await asyncio.wait_for(
            YahooFinanceProvider().get_quotes(list(symbols)), timeout=_LIVE_TIMEOUT_S
        )
    except Exception as exc:
        logger.warning("Live FX fallback failed for %s: %s", to_fetch, exc)
        quotes = {}
    fetched: dict[str, Decimal] = {}
    for symbol, currency in symbols.items():
        quote = quotes.get(symbol)
        if quote is not None and quote.price > 0:
            fetched[currency] = quote.price

    # Yahoo costuma bloquear IP de datacenter (a Vercel é um) — a PTAX do
    # Banco Central é a segunda fonte: oficial, sem chave, e o mesmo
    # endpoint que já alimenta o CDI do benchmark.
    for currency in [c for c in to_fetch if c not in fetched and c in _PTAX_SERIES]:
        rate = await _ptax_rate(currency)
        if rate:
            fetched[currency] = rate

    for currency in to_fetch:
        rate = fetched.get(currency)
        _live_cache[currency] = (now, rate)
        if rate:
            found[currency] = rate
    return found


# Séries SGS de venda (PTAX) por moeda.
_PTAX_SERIES = {"USD": 1, "EUR": 21619}


async def _ptax_rate(currency: str) -> Decimal | None:
    from datetime import date, timedelta

    from src.market_data.bcb import fetch_sgs_series

    today = date.today()
    try:
        points = await asyncio.wait_for(
            fetch_sgs_series(_PTAX_SERIES[currency], today - timedelta(days=10), today),
            timeout=_LIVE_TIMEOUT_S,
        )
    except Exception as exc:
        logger.warning("PTAX fallback failed for %s: %s", currency, exc)
        return None
    points = [p for p in points if p[1] > 0]
    return points[-1][1] if points else None


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

    # Sem linha no banco, 1:1 transformava USD 100 em R$ 100 e a carteira
    # internacional aparecia com -80% de "prejuízo". Tenta a cotação spot
    # antes de desistir.
    absent = needed - rates.keys()
    if absent:
        rates.update(await _live_rates_to_brl(absent))
    for currency in needed - rates.keys():
        logger.warning("No fx_rates row for %s->BRL; using 1:1 as a fallback", currency)
        rates[currency] = _ONE

    return rates
