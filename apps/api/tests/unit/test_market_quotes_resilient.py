"""get_quotes_resilient — cache negativo e última cotação conhecida.

Com Yahoo e Brapi bloqueados, cada request esperava o timeout dos dois de
novo e o ativo voltava sem preço (patrimônio despencando no gráfico). Usa um
Redis em memória mínimo, só com o que o cache chama."""
from decimal import Decimal

import pytest

from src.market_data.base import MarketDataProvider, Quote
from src.market_data.cache import MarketDataCache
from src.market_data.quotes import get_quotes_resilient


class _MemoryRedis:
    def __init__(self):
        self.store: dict[str, str] = {}

    async def get(self, key):
        return self.store.get(key)

    async def set(self, key, value, ex=None):
        self.store[key] = value

    async def mget(self, *keys):
        return [self.store.get(k) for k in keys]

    async def delete(self, key):
        self.store.pop(key, None)

    def pipeline(self):
        redis = self

        class _Pipe:
            def __init__(self):
                self.ops = []

            def set(self, key, value, ex=None):
                self.ops.append((key, value))

            async def execute(self):
                for key, value in self.ops:
                    redis.store[key] = value

        return _Pipe()


class _Provider(MarketDataProvider):
    def __init__(self, prices: dict[str, Decimal] | None = None, fail: bool = False):
        self.prices = prices or {}
        self.fail = fail
        self.calls: list[list[str]] = []

    @property
    def name(self):
        return "fake"

    async def get_quote(self, ticker):
        return None

    async def get_quotes(self, tickers):
        self.calls.append(list(tickers))
        if self.fail:
            raise TimeoutError("provider down")
        return {t: Quote(ticker=t, price=self.prices[t], currency="BRL") for t in tickers if t in self.prices}

    async def get_historical(self, ticker, period="1y", interval="1d"):
        return []


@pytest.mark.asyncio
async def test_falha_do_provedor_cai_na_ultima_cotacao_conhecida():
    redis = _MemoryRedis()
    cache = MarketDataCache(redis)
    await get_quotes_resilient(["PETR4"], cache, _Provider({"PETR4": Decimal("38")}))
    # Expira só a cotação fresca (5 min) — a "última conhecida" continua.
    redis.store.pop("quote:PETR4")

    quotes = await get_quotes_resilient(["PETR4"], cache, _Provider(fail=True))
    assert quotes["PETR4"].price == Decimal("38")


@pytest.mark.asyncio
async def test_ticker_que_falhou_nao_e_perguntado_de_novo_logo_em_seguida():
    cache = MarketDataCache(_MemoryRedis())
    provider = _Provider(fail=True)
    await get_quotes_resilient(["VALE3"], cache, provider)
    await get_quotes_resilient(["VALE3"], cache, provider)
    assert provider.calls == [["VALE3"]]


@pytest.mark.asyncio
async def test_preco_zero_nao_conta_como_cotacao():
    cache = MarketDataCache(_MemoryRedis())
    quotes = await get_quotes_resilient(["XPTO3"], cache, _Provider({"XPTO3": Decimal("0")}))
    assert quotes == {}


@pytest.mark.asyncio
async def test_sem_cache_ainda_busca_no_provedor():
    quotes = await get_quotes_resilient(["ITUB4"], None, _Provider({"ITUB4": Decimal("33")}))
    assert quotes["ITUB4"].price == Decimal("33")
