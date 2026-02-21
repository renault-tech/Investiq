"""Provider factory — selects market data provider based on user settings."""
from typing import Optional

import redis.asyncio as aioredis

from src.market_data.base import MarketDataProvider
from src.market_data.yahoo import YahooFinanceProvider
from src.market_data.brapi import BrapiProvider
from src.market_data.cache import MarketDataCache


def get_provider(
    preferred: str = "yahoo",
    brapi_key: Optional[str] = None,
) -> MarketDataProvider:
    """Return the appropriate market data provider.

    Args:
        preferred: 'yahoo' | 'brapi' | (future: 'alpha_vantage' | 'polygon')
        brapi_key: Optional Brapi API key for higher rate limits.

    Returns:
        Configured provider instance.
    """
    if preferred == "brapi":
        return BrapiProvider(api_key=brapi_key)
    # Default: Yahoo Finance (free, no key required)
    return YahooFinanceProvider()


def get_cache(redis: aioredis.Redis) -> MarketDataCache:
    """Return a configured cache instance."""
    return MarketDataCache(redis)
