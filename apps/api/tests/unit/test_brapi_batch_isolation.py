"""A Brapi devolve erro para o lote inteiro quando um único símbolo é
desconhecido — o que fazia um papel novo ou delistado zerar a cotação de
todos os outros da carteira junto."""
from decimal import Decimal

import httpx
import pytest

from src.market_data.brapi import BrapiProvider


class _FakeResponse:
    def __init__(self, payload: dict, status: int = 200):
        self._payload = payload
        self.status_code = status

    def json(self) -> dict:
        return self._payload

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise httpx.HTTPStatusError("erro", request=None, response=None)


def _quote(symbol: str, price: str) -> dict:
    return {"symbol": symbol, "regularMarketPrice": price}


class _FakeClient:
    """Rejeita qualquer lote que contenha o símbolo desconhecido, como a API real."""

    def __init__(self, known: dict[str, str], unknown: str):
        self._known = known
        self._unknown = unknown
        self.requested: list[list[str]] = []

    async def get(self, url: str, params=None):
        tickers = url.rsplit("/", 1)[-1].split(",")
        self.requested.append(tickers)
        if self._unknown in tickers:
            return _FakeResponse({}, status=404)
        return _FakeResponse(
            {"results": [_quote(t, self._known[t]) for t in tickers if t in self._known]}
        )


@pytest.mark.asyncio
async def test_simbolo_desconhecido_nao_zera_o_resto_do_lote():
    provider = BrapiProvider(api_key="tok")
    client = _FakeClient({"WEGE3": "52.30", "PETR4": "38.10"}, unknown="XPTO99")
    provider._client = client

    quotes = await provider.get_quotes(["WEGE3", "XPTO99", "PETR4"])

    assert quotes["WEGE3"].price == Decimal("52.30")
    assert quotes["PETR4"].price == Decimal("38.10")
    assert "XPTO99" not in quotes
    # Lote inteiro primeiro, depois um a um só porque o lote falhou por completo.
    assert client.requested[0] == ["WEGE3", "XPTO99", "PETR4"]
    assert len(client.requested) == 4


@pytest.mark.asyncio
async def test_lote_que_funciona_nao_gera_requisicao_extra():
    provider = BrapiProvider(api_key="tok")
    client = _FakeClient({"WEGE3": "52.30", "PETR4": "38.10"}, unknown="XPTO99")
    provider._client = client

    quotes = await provider.get_quotes(["WEGE3", "PETR4"])

    assert len(quotes) == 2
    assert client.requested == [["WEGE3", "PETR4"]]


class _UnreachableClient:
    """Simula a Brapi fora do ar / timeout — a conexão em si nunca conclui."""

    def __init__(self):
        self.requested: list[list[str]] = []

    async def get(self, url: str, params=None):
        self.requested.append(url.rsplit("/", 1)[-1].split(","))
        raise httpx.ConnectTimeout("timed out")


@pytest.mark.asyncio
async def test_falha_de_rede_nao_multiplica_tentativas_por_ticker():
    """Reconsultar um a um só faz sentido quando a Brapi respondeu com erro
    para o lote — se a conexão falhou, repetir N vezes só multiplica o mesmo
    timeout, podendo transformar uma falha de segundos numa espera de
    minutos (foi exatamente isso que travou a suíte de CI: cada ticker
    reconsultado esperava o timeout inteiro de novo)."""
    provider = BrapiProvider(api_key="tok")
    client = _UnreachableClient()
    provider._client = client

    quotes = await provider.get_quotes(["WEGE3", "PETR4", "VALE3"])

    assert quotes == {}
    # Uma tentativa só — nada de retentar ticker por ticker numa rede fora do ar.
    assert client.requested == [["WEGE3", "PETR4", "VALE3"]]
