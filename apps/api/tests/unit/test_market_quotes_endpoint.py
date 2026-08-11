"""GET /market/quotes — cotação em lote para a visão geral de mercado e a
watchlist. Chama o handler diretamente (sem TestClient) para não depender de
rede real; troca get_provider por um FakeProvider."""
from decimal import Decimal
from unittest.mock import patch

import pytest

from src.market_data import router as market_router
from src.market_data.base import MarketDataProvider, Quote


class FakeProvider(MarketDataProvider):
    def __init__(self, quotes: dict[str, Decimal]):
        self._quotes = quotes

    @property
    def name(self) -> str:
        return "fake"

    async def get_quote(self, ticker: str):
        return None

    async def get_quotes(self, tickers: list[str]) -> dict[str, Quote]:
        return {
            t: Quote(ticker=t, price=self._quotes[t], currency="BRL")
            for t in tickers
            if t in self._quotes
        }

    async def get_historical(self, ticker: str, period: str = "1y", interval: str = "1d"):
        return []


@pytest.mark.asyncio
async def test_devolve_cotacoes_na_ordem_pedida_e_pula_desconhecidos():
    fake_provider = FakeProvider({"^BVSP": Decimal("128000"), "PETR4": Decimal("38.10")})
    with patch.object(market_router, "get_provider", return_value=fake_provider):
        result = await market_router.get_quotes(
            tickers="PETR4,XPTO99,^BVSP",
            current_user=None,
            redis=None,
            provider_settings={"preferred": "yahoo", "brapi_key": None},
        )

    assert [q.ticker for q in result] == ["PETR4", "^BVSP"]
    assert result[0].price == Decimal("38.10")
    assert result[1].price == Decimal("128000")


@pytest.mark.asyncio
async def test_lista_vazia_nao_chama_o_provedor():
    with patch.object(market_router, "get_provider") as mock_get_provider:
        result = await market_router.get_quotes(
            tickers="   ,  ",
            current_user=None,
            redis=None,
            provider_settings={"preferred": "yahoo", "brapi_key": None},
        )

    assert result == []
    mock_get_provider.assert_not_called()


@pytest.mark.asyncio
async def test_tickers_duplicados_e_minusculos_sao_normalizados():
    fake_provider = FakeProvider({"AAPL": Decimal("190")})
    with patch.object(market_router, "get_provider", return_value=fake_provider):
        result = await market_router.get_quotes(
            tickers="aapl, AAPL",
            current_user=None,
            redis=None,
            provider_settings={"preferred": "yahoo", "brapi_key": None},
        )

    assert [q.ticker for q in result] == ["AAPL"]
