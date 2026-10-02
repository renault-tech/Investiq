"""get_fx_rates_to_brl: sem linha em fx_rates, tenta a cotação spot antes do
1:1 que transformava USD 100 em R$ 100 (carteira internacional com -80%)."""
from decimal import Decimal

import pytest

from src.market_data.base import Quote
from src.shared import fx


class _EmptyResult:
    def scalars(self):
        return self

    def all(self):
        return []


class _EmptyDb:
    async def execute(self, *_a, **_kw):
        return _EmptyResult()


@pytest.fixture(autouse=True)
def _clear_cache():
    fx._live_cache.clear()
    yield
    fx._live_cache.clear()


@pytest.mark.asyncio
async def test_usa_cotacao_spot_quando_o_banco_nao_tem_taxa(monkeypatch):
    calls = []

    class _Yahoo:
        async def get_quotes(self, symbols):
            calls.append(symbols)
            return {"USDBRL=X": Quote(ticker="USDBRL=X", price=Decimal("5.40"), currency="BRL")}

    monkeypatch.setattr("src.market_data.yahoo.YahooFinanceProvider", _Yahoo)
    rates = await fx.get_fx_rates_to_brl({"USD", "BRL"}, _EmptyDb())
    assert rates["USD"] == Decimal("5.40")
    assert rates["BRL"] == Decimal("1")

    # Segunda chamada vem do cache do processo, sem rede.
    await fx.get_fx_rates_to_brl({"USD"}, _EmptyDb())
    assert len(calls) == 1


@pytest.mark.asyncio
async def test_sem_cotacao_nenhuma_mantem_o_1_para_1(monkeypatch):
    class _Down:
        async def get_quotes(self, symbols):
            raise TimeoutError

    async def no_sgs(code, start, end):
        raise TimeoutError

    monkeypatch.setattr("src.market_data.yahoo.YahooFinanceProvider", _Down)
    monkeypatch.setattr("src.market_data.bcb.fetch_sgs_series", no_sgs)
    rates = await fx.get_fx_rates_to_brl({"USD"}, _EmptyDb())
    assert rates["USD"] == Decimal("1")


@pytest.mark.asyncio
async def test_cai_na_ptax_quando_o_yahoo_esta_bloqueado(monkeypatch):
    from datetime import date

    class _Down:
        async def get_quotes(self, symbols):
            raise TimeoutError

    async def fake_sgs(code, start, end):
        assert code == 1
        return [(date(2026, 9, 30), Decimal("5.31")), (date(2026, 10, 1), Decimal("5.33"))]

    monkeypatch.setattr("src.market_data.yahoo.YahooFinanceProvider", _Down)
    monkeypatch.setattr("src.market_data.bcb.fetch_sgs_series", fake_sgs)
    rates = await fx.get_fx_rates_to_brl({"USD"}, _EmptyDb())
    assert rates["USD"] == Decimal("5.33")
