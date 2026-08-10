"""Provider factory — selects market data provider based on user settings."""
from typing import Optional

import redis.asyncio as aioredis

from src.market_data.base import MarketDataProvider
from src.market_data.fallback import FallbackProvider
from src.market_data.yahoo import YahooFinanceProvider
from src.market_data.brapi import BrapiProvider
from src.market_data.cache import MarketDataCache


def get_provider(
    preferred: str = "yahoo",
    brapi_key: Optional[str] = None,
) -> MarketDataProvider:
    """Return the appropriate market data provider.

    O preferido do usuário vem primeiro, o outro entra como rede de proteção:
    fonte gratuita cai, bloqueia IP de datacenter ou simplesmente não cobre um
    papel, e sem encadear os dois o ativo aparece sem preço atual — sintoma
    idêntico a "ticker inexistente" para quem está olhando a carteira.

    Args:
        preferred: 'yahoo' | 'brapi' | (future: 'alpha_vantage' | 'polygon')
        brapi_key: Optional Brapi API key for higher rate limits.

    Returns:
        Configured provider instance.
    """
    yahoo = YahooFinanceProvider()
    brapi = BrapiProvider(api_key=brapi_key)
    if preferred == "brapi":
        return FallbackProvider(primary=brapi, secondary=yahoo)
    # Default: Yahoo Finance (free, no key required)
    return FallbackProvider(primary=yahoo, secondary=brapi)


def get_cache(redis: aioredis.Redis) -> MarketDataCache:
    """Return a configured cache instance."""
    return MarketDataCache(redis)
