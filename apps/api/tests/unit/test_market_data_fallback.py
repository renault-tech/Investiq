"""FallbackProvider — o encadeamento que impede um provedor fora do ar de
virar "ativo sem preço" na carteira."""
from decimal import Decimal

import pytest

from src.market_data.base import HistoricalBar, MarketDataProvider, Quote
from src.market_data.fallback import FallbackProvider


class FakeProvider(MarketDataProvider):
    def __init__(self, name: str, quotes: dict[str, Decimal] | None = None, raises: bool = False):
        self._name = name
        self._quotes = quotes or {}
        self._raises = raises
        self.batches: list[list[str]] = []

    @property
    def name(self) -> str:
        return self._name

    async def get_quote(self, ticker: str):
        if self._raises:
            raise RuntimeError(f"{self._name} fora do ar")
        price = self._quotes.get(ticker)
        if price is None:
            return None
        return Quote(ticker=ticker, price=price, currency="BRL")

    async def get_quotes(self, tickers: list[str]) -> dict[str, Quote]:
        self.batches.append(list(tickers))
        if self._raises:
            raise RuntimeError(f"{self._name} fora do ar")
        return {
            t: Quote(ticker=t, price=self._quotes[t], currency="BRL")
            for t in tickers
            if t in self._quotes
        }

    async def get_historical(self, ticker: str, period: str = "1y", interval: str = "1d"):
        if self._raises:
            raise RuntimeError(f"{self._name} fora do ar")
        return []


@pytest.mark.asyncio
async def test_secondary_cobre_ticker_que_o_primario_nao_tem():
    provider = FallbackProvider(
        primary=FakeProvider("yahoo", {"AAPL": Decimal("190")}),
        secondary=FakeProvider("brapi", {"WEGE3": Decimal("52.30")}),
    )
    quote = await provider.get_quote("WEGE3")
    assert quote is not None
    assert quote.price == Decimal("52.30")


@pytest.mark.asyncio
async def test_primario_fora_do_ar_nao_derruba_a_consulta():
    provider = FallbackProvider(
        primary=FakeProvider("yahoo", raises=True),
        secondary=FakeProvider("brapi", {"WEGE3": Decimal("52.30")}),
    )
    quote = await provider.get_quote("WEGE3")
    assert quote is not None
    assert quote.price == Decimal("52.30")


@pytest.mark.asyncio
async def test_preco_zero_do_primario_conta_como_ausencia():
    """Yahoo devolve price=0 para papel que não encontrou. Sem tratar isso
    como ausência, o fallback nunca dispara e a carteira mostra R$ 0,00."""
    provider = FallbackProvider(
        primary=FakeProvider("yahoo", {"WEGE3": Decimal("0")}),
        secondary=FakeProvider("brapi", {"WEGE3": Decimal("52.30")}),
    )
    quote = await provider.get_quote("WEGE3")
    assert quote is not None
    assert quote.price == Decimal("52.30")


@pytest.mark.asyncio
async def test_get_quotes_mescla_os_dois_provedores():
    provider = FallbackProvider(
        primary=FakeProvider("yahoo", {"AAPL": Decimal("190"), "WEGE3": Decimal("0")}),
        secondary=FakeProvider("brapi", {"WEGE3": Decimal("52.30"), "PETR4": Decimal("38.10")}),
    )
    quotes = await provider.get_quotes(["AAPL", "WEGE3", "PETR4"])
    assert quotes["AAPL"].price == Decimal("190")
    assert quotes["WEGE3"].price == Decimal("52.30")
    assert quotes["PETR4"].price == Decimal("38.10")


@pytest.mark.asyncio
async def test_brapi_so_recebe_tickers_da_b3():
    """A Brapi responde erro para o lote inteiro quando um símbolo é
    desconhecido — mandar BTC-USD junto zerava a cotação da WEGE3 também."""
    brapi = FakeProvider("brapi", {"WEGE3": Decimal("52.30")})
    provider = FallbackProvider(primary=FakeProvider("yahoo", raises=True), secondary=brapi)

    quotes = await provider.get_quotes(["WEGE3", "BTC-USD", "^BVSP", "USDBRL=X", "AAPL"])

    assert brapi.batches == [["WEGE3"]]
    assert quotes["WEGE3"].price == Decimal("52.30")


@pytest.mark.asyncio
async def test_sem_ticker_da_b3_nao_chama_a_brapi():
    brapi = FakeProvider("brapi", {})
    provider = FallbackProvider(primary=FakeProvider("yahoo", raises=True), secondary=brapi)

    assert await provider.get_quotes(["BTC-USD", "AAPL"]) == {}
    assert brapi.batches == []


@pytest.mark.asyncio
async def test_ambos_sem_o_papel_devolve_none_em_vez_de_estourar():
    provider = FallbackProvider(
        primary=FakeProvider("yahoo", raises=True),
        secondary=FakeProvider("brapi", raises=True),
    )
    assert await provider.get_quote("XPTO99") is None
    assert await provider.get_quotes(["XPTO99"]) == {}
