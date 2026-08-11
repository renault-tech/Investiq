"""Look-through geográfico e setorial — redistribuição do valor de cada
posição nos baldes de setor/país/classe de ativo, olhando através dos ETFs
para suas maiores posições."""
import uuid
from decimal import Decimal
from unittest.mock import AsyncMock, patch

import pytest

from src.market_data.base import Fundamentals, FundComposition, FundHolding, MarketDataProvider, Quote
from src.portfolio import look_through


class FakeProvider(MarketDataProvider):
    """Provedor de teste com fundamentals e composição de fundo pré-definidos."""

    def __init__(self, fundamentals: dict[str, Fundamentals], compositions: dict[str, FundComposition]):
        self._fundamentals = fundamentals
        self._compositions = compositions

    @property
    def name(self) -> str:
        return "fake"

    async def get_quote(self, ticker: str):
        return None

    async def get_quotes(self, tickers: list[str]) -> dict[str, Quote]:
        return {}

    async def get_historical(self, ticker: str, period: str = "1y", interval: str = "1d"):
        return []

    async def get_fundamentals(self, ticker: str):
        return self._fundamentals.get(ticker)

    async def get_fund_composition(self, ticker: str):
        return self._compositions.get(ticker)


def _summary(positions: list[dict], total_value: Decimal) -> dict:
    return {
        "portfolio_id": uuid.uuid4(),
        "portfolio_name": "Carteira teste",
        "total_invested_brl": total_value,
        "total_market_value_brl": total_value,
        "total_pnl_absolute": Decimal("0"),
        "total_pnl_percent": Decimal("0"),
        "positions": positions,
        "rebalance_suggestions": [],
        "allocation_by_type": [],
    }


@pytest.mark.asyncio
async def test_carteira_vazia_devolve_baldes_vazios():
    with patch.object(look_through.portfolio_service, "get_portfolio_summary", AsyncMock(return_value=_summary([], Decimal("0")))):
        result = await look_through.get_portfolio_look_through(uuid.uuid4(), uuid.uuid4(), db=None)
    assert result["by_sector"] == []
    assert result["by_country"] == []
    assert result["by_asset_class"] == []
    assert result["country_coverage"] == Decimal("0")


@pytest.mark.asyncio
async def test_etf_e_acao_consolidam_setor_pais_e_classe():
    fundamentals = {
        "IVVB11": Fundamentals(ticker="IVVB11", quote_type="ETF"),
        "WEGE3": Fundamentals(ticker="WEGE3", quote_type="EQUITY", sector="Industrials", country="Brazil"),
        "AAPL": Fundamentals(ticker="AAPL", country="United States"),
        "MSFT": Fundamentals(ticker="MSFT", country="United States"),
    }
    compositions = {
        "IVVB11": FundComposition(
            ticker="IVVB11",
            sector_weights={"technology": Decimal("0.6"), "healthcare": Decimal("0.4")},
            asset_class_weights={"stock_position": Decimal("1.0")},
            top_holdings=[
                FundHolding(symbol="AAPL", name="Apple", weight=Decimal("0.5")),
                FundHolding(symbol="MSFT", name="Microsoft", weight=Decimal("0.3")),
            ],
        ),
    }
    fake_provider = FakeProvider(fundamentals, compositions)

    positions = [
        {"ticker": "IVVB11", "market_value_brl": Decimal("6000")},
        {"ticker": "WEGE3", "market_value_brl": Decimal("4000")},
    ]
    summary = _summary(positions, Decimal("10000"))

    with patch.object(look_through.portfolio_service, "get_portfolio_summary", AsyncMock(return_value=summary)), \
         patch.object(look_through, "get_provider", return_value=fake_provider):
        result = await look_through.get_portfolio_look_through(uuid.uuid4(), uuid.uuid4(), db=None)

    by_sector = {b["label"]: b["value_brl"] for b in result["by_sector"]}
    assert by_sector["Tecnologia"] == Decimal("3600")
    assert by_sector["Saúde"] == Decimal("2400")
    assert by_sector["Industrial"] == Decimal("4000")

    by_country = {b["label"]: b["value_brl"] for b in result["by_country"]}
    assert by_country["Estados Unidos"] == Decimal("4800")   # (0.5+0.3)*6000
    assert by_country["Não mapeado"] == Decimal("1200")      # gap in top-holdings sample: 0.2*6000
    assert by_country["Brasil"] == Decimal("4000")

    by_class = {b["label"]: b["value_brl"] for b in result["by_asset_class"]}
    assert by_class["Ações"] == Decimal("10000")   # 6000 (fund's stock_position) + 4000 (direct equity)

    # coverage = resolved country value / total value = (4800 + 4000) / 10000
    assert result["country_coverage"] == Decimal("0.88")

    # buckets sorted descending by value
    assert [b["value_brl"] for b in result["by_sector"]] == sorted(
        [b["value_brl"] for b in result["by_sector"]], reverse=True
    )


@pytest.mark.asyncio
async def test_fundo_sem_composicao_disponivel_cai_em_nao_classificado():
    fundamentals = {"XPTO11": Fundamentals(ticker="XPTO11", quote_type="ETF")}
    fake_provider = FakeProvider(fundamentals, compositions={})
    positions = [{"ticker": "XPTO11", "market_value_brl": Decimal("1000")}]
    summary = _summary(positions, Decimal("1000"))

    with patch.object(look_through.portfolio_service, "get_portfolio_summary", AsyncMock(return_value=summary)), \
         patch.object(look_through, "get_provider", return_value=fake_provider):
        result = await look_through.get_portfolio_look_through(uuid.uuid4(), uuid.uuid4(), db=None)

    assert result["by_sector"][0]["label"] == "Não classificado"
    assert result["by_sector"][0]["value_brl"] == Decimal("1000")
    assert result["by_country"][0]["label"] == "Não mapeado"
    assert result["country_coverage"] == Decimal("0")
