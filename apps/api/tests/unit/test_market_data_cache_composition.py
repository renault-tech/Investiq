"""MarketDataCache — round-trip de Fundamentals (com os campos novos
country/quote_type) e de FundComposition. Regressão direta do bug em que o
cache tentava `Decimal("United States")` porque a lista de campos-string do
dataclass não tinha sido atualizada."""
from decimal import Decimal

import pytest

from src.market_data.base import Fundamentals, FundComposition, FundHolding
from src.market_data.cache import MarketDataCache


class FakeRedis:
    """Redis mínimo o bastante para get/setex — sem TTL real, só o suficiente
    para exercitar a (de)serialização."""

    def __init__(self):
        self._store: dict[str, str] = {}

    async def get(self, key: str):
        return self._store.get(key)

    async def setex(self, key: str, ttl: int, value: str):
        self._store[key] = value


@pytest.mark.asyncio
async def test_fundamentals_com_country_e_quote_type_sobrevive_ao_cache():
    cache = MarketDataCache(FakeRedis())
    original = Fundamentals(
        ticker="AAPL",
        name="Apple Inc",
        sector="Technology",
        country="United States",
        quote_type="EQUITY",
        market_cap=Decimal("3000000000000"),
        dividend_yield=Decimal("0.005"),
    )
    await cache.set_fundamentals(original)
    restored = await cache.get_fundamentals("AAPL")

    assert restored is not None
    assert restored.country == "United States"
    assert restored.quote_type == "EQUITY"
    assert restored.market_cap == Decimal("3000000000000")
    assert restored.dividend_yield == Decimal("0.005")


@pytest.mark.asyncio
async def test_fund_composition_sobrevive_ao_cache():
    cache = MarketDataCache(FakeRedis())
    original = FundComposition(
        ticker="IVVB11",
        sector_weights={"technology": Decimal("0.6"), "healthcare": Decimal("0.4")},
        asset_class_weights={"stock_position": Decimal("1.0")},
        top_holdings=[
            FundHolding(symbol="AAPL", name="Apple Inc", weight=Decimal("0.5")),
            FundHolding(symbol="MSFT", name="Microsoft Corp", weight=Decimal("0.3")),
        ],
    )
    await cache.set_fund_composition(original)
    restored = await cache.get_fund_composition("IVVB11")

    assert restored is not None
    assert restored.sector_weights["technology"] == Decimal("0.6")
    assert restored.asset_class_weights["stock_position"] == Decimal("1.0")
    assert len(restored.top_holdings) == 2
    assert restored.top_holdings[0].symbol == "AAPL"
    assert restored.top_holdings[0].weight == Decimal("0.5")


@pytest.mark.asyncio
async def test_cache_miss_devolve_none():
    cache = MarketDataCache(FakeRedis())
    assert await cache.get_fundamentals("NONEXISTENT") is None
    assert await cache.get_fund_composition("NONEXISTENT") is None
