"""GET /market/sparklines — fechamentos recentes em lote para o mini-gráfico
da watchlist. Mesmo padrão de test_market_quotes_endpoint.py: chama o handler
direto, sem TestClient nem rede real."""
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import patch

import pytest

from src.market_data import router as market_router
from src.market_data.base import HistoricalBar, MarketDataProvider, Quote


class FakeProvider(MarketDataProvider):
    def __init__(self, bars_by_ticker: dict[str, list[Decimal]]):
        self._bars_by_ticker = bars_by_ticker

    @property
    def name(self) -> str:
        return "fake"

    async def get_quote(self, ticker: str):
        return None

    async def get_quotes(self, tickers: list[str]) -> dict[str, Quote]:
        return {}

    async def get_historical(self, ticker: str, period: str = "1y", interval: str = "1d"):
        closes = self._bars_by_ticker.get(ticker)
        if closes is None:
            return []
        base = datetime.now(timezone.utc)
        return [
            HistoricalBar(
                ticker=ticker, date=base - timedelta(days=len(closes) - i),
                open=close, high=close, low=close, close=close, volume=1000,
            )
            for i, close in enumerate(closes)
        ]


@pytest.mark.asyncio
async def test_devolve_fechamentos_por_ticker_na_ordem_pedida():
    fake_provider = FakeProvider({
        "PETR4": [Decimal("38.00"), Decimal("38.50"), Decimal("39.10")],
        "AAPL": [Decimal("190"), Decimal("188")],
    })
    with patch.object(market_router, "get_provider", return_value=fake_provider):
        result = await market_router.get_sparklines(
            tickers="PETR4,AAPL",
            period="1mo",
            current_user=None,
            redis=None,
            provider_settings={"preferred": "yahoo", "brapi_key": None},
        )

    assert [s.ticker for s in result] == ["PETR4", "AAPL"]
    assert result[0].closes == [Decimal("38.00"), Decimal("38.50"), Decimal("39.10")]
    assert result[1].closes == [Decimal("190"), Decimal("188")]


@pytest.mark.asyncio
async def test_ticker_sem_historico_e_omitido_sem_derrubar_os_outros():
    fake_provider = FakeProvider({"PETR4": [Decimal("38"), Decimal("39")]})
    with patch.object(market_router, "get_provider", return_value=fake_provider):
        result = await market_router.get_sparklines(
            tickers="PETR4,XPTO99",
            period="1mo",
            current_user=None,
            redis=None,
            provider_settings={"preferred": "yahoo", "brapi_key": None},
        )

    assert [s.ticker for s in result] == ["PETR4"]


@pytest.mark.asyncio
async def test_lista_vazia_nao_chama_o_provedor():
    with patch.object(market_router, "get_provider") as mock_get_provider:
        result = await market_router.get_sparklines(
            tickers="  ,  ",
            period="1mo",
            current_user=None,
            redis=None,
            provider_settings={"preferred": "yahoo", "brapi_key": None},
        )

    assert result == []
    mock_get_provider.assert_not_called()


@pytest.mark.asyncio
async def test_periodo_invalido_e_rejeitado():
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc_info:
        await market_router.get_sparklines(
            tickers="PETR4",
            period="10y",
            current_user=None,
            redis=None,
            provider_settings={"preferred": "yahoo", "brapi_key": None},
        )
    assert exc_info.value.status_code == 422


@pytest.mark.asyncio
async def test_falha_num_ticker_nao_derruba_os_outros():
    class FlakyProvider(FakeProvider):
        async def get_historical(self, ticker: str, period: str = "1y", interval: str = "1d"):
            if ticker == "XPTO99":
                raise RuntimeError("provider timeout")
            return await super().get_historical(ticker, period, interval)

    fake_provider = FlakyProvider({"PETR4": [Decimal("38"), Decimal("39")]})
    with patch.object(market_router, "get_provider", return_value=fake_provider):
        result = await market_router.get_sparklines(
            tickers="XPTO99,PETR4",
            period="1mo",
            current_user=None,
            redis=None,
            provider_settings={"preferred": "yahoo", "brapi_key": None},
        )

    assert [s.ticker for s in result] == ["PETR4"]
