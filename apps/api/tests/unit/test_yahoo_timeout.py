"""YahooFinanceProvider — uma chamada travada não pode travar a rota.

yfinance roda de forma síncrona num executor, sem timeout próprio, e
datacenter IP (Vercel, runner de CI) é justamente o que o Yahoo bloqueia
com mais agressividade — às vezes devagar, deixando a conexão pendurada em
vez de rejeitar na hora. Sem teto, isso trava a rota inteira em vez de
degradar como "sem cotação", que é como o resto do provedor já se comporta.
"""
import asyncio
import time
from unittest.mock import patch

import pytest

from src.market_data import yahoo as yahoo_module
from src.market_data.yahoo import YahooFinanceProvider


@pytest.mark.asyncio
async def test_get_quotes_nao_trava_alem_do_teto_de_tempo(monkeypatch):
    monkeypatch.setattr(yahoo_module, "_CALL_TIMEOUT_S", 0.2)

    def _hangs_forever(tickers):
        time.sleep(5)  # bem além do teto — simula o Yahoo pendurando a conexão
        return {"PETR4": object()}

    provider = YahooFinanceProvider()
    with patch.object(provider, "_fetch_quotes_sync", side_effect=_hangs_forever):
        start = asyncio.get_event_loop().time()
        result = await provider.get_quotes(["PETR4"])
        elapsed = asyncio.get_event_loop().time() - start

    assert result == {}
    assert elapsed < 1.0  # cortado pelo teto de 0.2s, não pelos 5s do sleep


@pytest.mark.asyncio
async def test_get_historical_degrada_para_lista_vazia_no_timeout(monkeypatch):
    monkeypatch.setattr(yahoo_module, "_CALL_TIMEOUT_S", 0.2)

    def _hangs_forever(ticker, period, interval):
        time.sleep(5)
        return []

    provider = YahooFinanceProvider()
    with patch.object(provider, "_fetch_history_sync", side_effect=_hangs_forever):
        result = await provider.get_historical("PETR4")

    assert result == []


@pytest.mark.asyncio
async def test_get_fundamentals_degrada_para_none_no_timeout(monkeypatch):
    monkeypatch.setattr(yahoo_module, "_CALL_TIMEOUT_S", 0.2)

    def _hangs_forever(ticker):
        time.sleep(5)
        return None

    provider = YahooFinanceProvider()
    with patch.object(provider, "_fetch_fundamentals_sync", side_effect=_hangs_forever):
        result = await provider.get_fundamentals("PETR4")

    assert result is None


@pytest.mark.asyncio
async def test_chamada_rapida_nao_e_afetada_pelo_teto(monkeypatch):
    """O teto só corta o que realmente está travado — uma resposta rápida
    passa direto, sem esperar o timeout todo."""
    monkeypatch.setattr(yahoo_module, "_CALL_TIMEOUT_S", 5.0)

    provider = YahooFinanceProvider()
    with patch.object(provider, "_fetch_fundamentals_sync", return_value=None) as mock_fetch:
        result = await provider.get_fundamentals("PETR4")

    assert result is None
    mock_fetch.assert_called_once_with("PETR4")
