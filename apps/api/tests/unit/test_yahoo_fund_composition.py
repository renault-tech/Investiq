"""YahooFinanceProvider.get_fund_composition — parsing do FundsData do
yfinance (setor, classe de ativo, maiores posições) para o look-through."""
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest

from src.market_data.yahoo import YahooFinanceProvider


class FakeFundsData:
    def __init__(self):
        self.sector_weightings = {"technology": 0.6, "healthcare": 0.4}
        self.asset_classes = {"stockPosition": 1.0}
        self.top_holdings = pd.DataFrame(
            {"Name": ["Apple Inc", "Microsoft Corp"], "Holding Percent": [0.5, 0.3]},
            index=pd.Index(["AAPL", "MSFT"], name="Symbol"),
        )


@pytest.mark.asyncio
async def test_parses_setor_classe_e_maiores_posicoes():
    fake_ticker = MagicMock()
    fake_ticker.funds_data = FakeFundsData()
    with patch("yfinance.Ticker", return_value=fake_ticker):
        composition = await YahooFinanceProvider().get_fund_composition("IVVB11")

    assert composition is not None
    assert composition.sector_weights["technology"] == Decimal("0.6")
    assert composition.sector_weights["healthcare"] == Decimal("0.4")
    assert composition.asset_class_weights["stockPosition"] == Decimal("1.0")
    assert len(composition.top_holdings) == 2
    aapl = next(h for h in composition.top_holdings if h.symbol == "AAPL")
    assert aapl.weight == Decimal("0.5")
    assert aapl.name == "Apple Inc"


@pytest.mark.asyncio
async def test_ticker_sem_funds_data_devolve_none():
    """Uma ação comum (não-fundo) não tem `funds_data` — não deve quebrar."""
    fake_ticker = MagicMock()
    fake_ticker.funds_data = None
    with patch("yfinance.Ticker", return_value=fake_ticker):
        composition = await YahooFinanceProvider().get_fund_composition("AAPL")
    assert composition is None


@pytest.mark.asyncio
async def test_excecao_do_yfinance_nao_derruba_a_chamada():
    fake_ticker = MagicMock()
    type(fake_ticker).funds_data = property(lambda self: (_ for _ in ()).throw(RuntimeError("boom")))
    with patch("yfinance.Ticker", return_value=fake_ticker):
        composition = await YahooFinanceProvider().get_fund_composition("XPTO11")
    assert composition is None
