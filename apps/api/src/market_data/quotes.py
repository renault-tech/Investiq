"""Cotações em lote com cache, cache negativo e último preço conhecido.

Antes cada rota repetia o mesmo "cache, senão provedor" e, com Yahoo e Brapi
bloqueados (acontece com IP de datacenter), cada request esperava os
timeouts dos dois de novo e o ativo voltava sem preço. Aqui:

1. cotação fresca do cache (5 min) — caminho normal;
2. o que falta é pedido ao provedor, exceto tickers que falharam há menos
   de MISS_TTL segundos (cache negativo — não paga o timeout de novo);
3. o que ainda falta cai na última cotação conhecida (até 7 dias), para o
   patrimônio não despencar só porque a fonte de preço piscou.
"""
import logging
from typing import Optional

from src.market_data.base import MarketDataProvider, Quote
from src.market_data.cache import MarketDataCache

logger = logging.getLogger(__name__)


async def get_quotes_resilient(
    tickers: list[str],
    cache: Optional[MarketDataCache],
    provider: MarketDataProvider,
) -> dict[str, Quote]:
    tickers = list(dict.fromkeys(tickers))
    if not tickers:
        return {}

    quotes: dict[str, Quote] = await cache.get_quotes(tickers) if cache else {}
    missing = [t for t in tickers if t not in quotes]
    if not missing:
        return quotes

    recent_misses = await cache.get_recent_misses(missing) if cache else set()
    to_fetch = [t for t in missing if t not in recent_misses]
    if to_fetch:
        try:
            fresh = await provider.get_quotes(to_fetch)
        except Exception as exc:
            logger.warning("Live quote fetch failed for %s: %s", to_fetch, exc)
            fresh = {}
        fresh = {t: q for t, q in fresh.items() if q is not None and q.price > 0}
        quotes.update(fresh)
        if cache:
            if fresh:
                await cache.set_quotes(fresh)
            failed = [t for t in to_fetch if t not in fresh]
            if failed:
                await cache.mark_misses(failed)

    still_missing = [t for t in tickers if t not in quotes]
    if still_missing and cache:
        quotes.update(await cache.get_last_known_quotes(still_missing))
    return quotes
