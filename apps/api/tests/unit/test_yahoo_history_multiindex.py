"""YahooFinanceProvider.get_historical — regressão do bug em produção:
"The truth value of a Series is ambiguous" para dezenas de tickers, porque
`yf.download()` às vezes devolve colunas MultiIndex mesmo para um único
ticker, e `row.get("Volume") or 0` estoura ao tentar avaliar um Series como
booleano."""
from decimal import Decimal
from unittest.mock import patch

import pandas as pd
import pytest

from src.market_data.yahoo import YahooFinanceProvider


def _multiindex_df() -> pd.DataFrame:
    dates = pd.to_datetime(["2026-08-08", "2026-08-09", "2026-08-10"])
    data = {
        ("Open", "PETR4.SA"): [38.0, 38.5, 39.0],
        ("High", "PETR4.SA"): [38.8, 39.2, 39.5],
        ("Low", "PETR4.SA"): [37.9, 38.3, 38.9],
        ("Close", "PETR4.SA"): [38.6, 39.0, 39.3],
        ("Volume", "PETR4.SA"): [1000000, 1200000, 900000],
    }
    df = pd.DataFrame(data, index=dates)
    df.columns = pd.MultiIndex.from_tuples(df.columns)
    return df


@pytest.mark.asyncio
async def test_multiindex_columns_nao_quebra_o_parse():
    with patch("yfinance.download", return_value=_multiindex_df()):
        bars = await YahooFinanceProvider().get_historical("PETR4", period="1y", interval="1d")

    assert len(bars) == 3
    assert bars[0].close == Decimal("38.6")
    assert bars[0].volume == 1000000
    assert bars[-1].close == Decimal("39.3")


@pytest.mark.asyncio
async def test_colunas_simples_continuam_funcionando():
    dates = pd.to_datetime(["2026-08-10"])
    df = pd.DataFrame(
        {"Open": [190.0], "High": [192.0], "Low": [189.0], "Close": [191.5], "Volume": [5000000]},
        index=dates,
    )
    with patch("yfinance.download", return_value=df):
        bars = await YahooFinanceProvider().get_historical("AAPL", period="1y", interval="1d")

    assert len(bars) == 1
    assert bars[0].close == Decimal("191.5")
    assert bars[0].volume == 5000000


@pytest.mark.asyncio
async def test_dataframe_vazio_devolve_lista_vazia():
    with patch("yfinance.download", return_value=pd.DataFrame()):
        bars = await YahooFinanceProvider().get_historical("XPTO99", period="1y", interval="1d")
    assert bars == []
