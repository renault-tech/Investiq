"""Look-through geográfico e setorial: consolida a carteira além do que cada
posição "parece ser" — um ETF de S&P 500 não é um ativo, é uma fatia de
centenas de empresas espalhadas por setor e (por amostragem das maiores
posições) por país. Esta função reprocessa cada posição da carteira e
redistribui seu valor de mercado nesses baldes, ponderado pelo peso de cada
posição na carteira e pelo peso de cada setor/país dentro do próprio fundo.

Fonte de dados: só gratuita, por decisão do usuário — `FundsData` do
yfinance para setor/classe de ativo dos fundos, e `sector`/`country` do
Yahoo (ou Brapi, para B3) para ações individuais. Não existe endpoint
gratuito com a composição geográfica direta de um fundo; a geografia é
estimada a partir do país de cada uma das maiores posições do fundo
(`top_holdings`), por isso o resultado inclui `country_coverage` — a fração
da carteira cujo país foi de fato resolvido, para a UI ser transparente
sobre a amostragem em vez de fingir precisão que a fonte não tem.
"""
import asyncio
import uuid
from decimal import Decimal
from typing import Awaitable, Callable, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from src.market_data.base import FundComposition, Fundamentals
from src.market_data.factory import get_cache, get_provider
from src.portfolio import service as portfolio_service

_ZERO = Decimal("0")
_ONE = Decimal("1")

# Yahoo quoteType values that mean "this is a basket, not a single company" —
# only these get the top-holdings look-through; everything else is treated
# as a single-sector, single-country position.
_FUND_QUOTE_TYPES = {"ETF", "MUTUALFUND", "INDEX"}

# Top holdings resolved per fund for the geography estimate. Bounded because
# each unresolved holding costs one more fundamentals fetch (cached 24h
# afterwards, but the first view of a portfolio pays the full cost).
_MAX_HOLDINGS_RESOLVED = 15

_UNCLASSIFIED = "Não classificado"
_UNMAPPED = "Não mapeado"
_EQUITY_LABEL = "Ações"

_SECTOR_LABELS = {
    "technology": "Tecnologia",
    "healthcare": "Saúde",
    "health_care": "Saúde",
    "financial_services": "Serviços financeiros",
    "financials": "Serviços financeiros",
    "consumer_cyclical": "Consumo cíclico",
    "consumer_discretionary": "Consumo cíclico",
    "consumer_defensive": "Consumo não cíclico",
    "consumer_staples": "Consumo não cíclico",
    "industrials": "Industrial",
    "energy": "Energia",
    "utilities": "Utilidade pública",
    "real_estate": "Imóveis",
    "realestate": "Imóveis",
    "basic_materials": "Materiais básicos",
    "materials": "Materiais básicos",
    "communication_services": "Comunicações",
    "telecommunications_services": "Comunicações",
}

_COUNTRY_LABELS = {
    "united states": "Estados Unidos",
    "brazil": "Brasil",
    "china": "China",
    "japan": "Japão",
    "united kingdom": "Reino Unido",
    "germany": "Alemanha",
    "france": "França",
    "canada": "Canadá",
    "south korea": "Coreia do Sul",
    "taiwan": "Taiwan",
    "india": "Índia",
    "switzerland": "Suíça",
    "netherlands": "Holanda",
    "ireland": "Irlanda",
    "spain": "Espanha",
    "italy": "Itália",
    "australia": "Austrália",
    "mexico": "México",
    "hong kong": "Hong Kong",
    "singapore": "Cingapura",
    "sweden": "Suécia",
    "israel": "Israel",
    "cayman islands": "Ilhas Cayman",
    "bermuda": "Bermudas",
    "luxembourg": "Luxemburgo",
    "denmark": "Dinamarca",
    "norway": "Noruega",
    "finland": "Finlândia",
    "belgium": "Bélgica",
    "south africa": "África do Sul",
    "argentina": "Argentina",
    "chile": "Chile",
}

_ASSET_CLASS_LABELS = {
    "stock_position": "Ações",
    "bond_position": "Renda fixa",
    "cash_position": "Caixa",
    "other_position": "Outros",
    "preferred_position": "Ações preferenciais",
    "convertible_position": "Conversíveis",
}


def _normalize_key(raw: str) -> str:
    return raw.strip().lower().replace(" ", "_").replace("-", "_")


def _translate_sector(raw: str) -> str:
    key = _normalize_key(raw)
    return _SECTOR_LABELS.get(key, raw.strip().replace("_", " ").title())


def _translate_country(raw: str) -> str:
    return _COUNTRY_LABELS.get(raw.strip().lower(), raw.strip())


def _translate_asset_class(raw: str) -> str:
    key = _normalize_key(raw)
    return _ASSET_CLASS_LABELS.get(key, raw.strip().replace("_", " ").title())


def _add(totals: dict[str, Decimal], label: str, amount: Decimal) -> None:
    if amount is None or amount <= _ZERO:
        return
    totals[label] = totals.get(label, _ZERO) + amount


async def _distribute_fund(
    market_value: Decimal,
    composition: Optional[FundComposition],
    sector_totals: dict[str, Decimal],
    country_totals: dict[str, Decimal],
    asset_class_totals: dict[str, Decimal],
    fundamentals_for: Callable[[str], Awaitable[Optional[Fundamentals]]],
) -> Decimal:
    """Fan out one ETF/fund position's market value into the aggregate
    buckets. Returns the slice of `market_value` whose country was actually
    resolved (feeds the portfolio-wide `country_coverage` metric)."""
    if composition is None:
        _add(sector_totals, _UNCLASSIFIED, market_value)
        _add(country_totals, _UNMAPPED, market_value)
        _add(asset_class_totals, _UNCLASSIFIED, market_value)
        return _ZERO

    if composition.sector_weights:
        covered = _ZERO
        for key, weight in composition.sector_weights.items():
            _add(sector_totals, _translate_sector(key), market_value * weight)
            covered += weight
        _add(sector_totals, _UNCLASSIFIED, market_value * max(_ZERO, _ONE - covered))
    else:
        _add(sector_totals, _UNCLASSIFIED, market_value)

    if composition.asset_class_weights:
        covered = _ZERO
        for key, weight in composition.asset_class_weights.items():
            _add(asset_class_totals, _translate_asset_class(key), market_value * weight)
            covered += weight
        _add(asset_class_totals, _UNCLASSIFIED, market_value * max(_ZERO, _ONE - covered))
    else:
        _add(asset_class_totals, _UNCLASSIFIED, market_value)

    holdings = composition.top_holdings[:_MAX_HOLDINGS_RESOLVED]
    if not holdings:
        _add(country_totals, _UNMAPPED, market_value)
        return _ZERO

    holding_fundamentals = await asyncio.gather(*(fundamentals_for(h.symbol) for h in holdings))
    covered_country = _ZERO
    for holding, hf in zip(holdings, holding_fundamentals):
        if hf and hf.country:
            _add(country_totals, _translate_country(hf.country), market_value * holding.weight)
            covered_country += holding.weight
    _add(country_totals, _UNMAPPED, market_value * max(_ZERO, _ONE - covered_country))

    return market_value * covered_country


async def get_portfolio_look_through(
    portfolio_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession,
    redis=None,
    preferred_provider: str = "yahoo",
    brapi_key: Optional[str] = None,
) -> dict:
    """Distribuição da carteira por setor, país e classe de ativo, olhando
    através de cada ETF/fundo para suas posições subjacentes."""
    summary = await portfolio_service.get_portfolio_summary(
        portfolio_id=portfolio_id,
        user_id=user_id,
        db=db,
        redis=redis,
        preferred_provider=preferred_provider,
        brapi_key=brapi_key,
    )
    positions = summary["positions"]
    total_value = summary["total_market_value_brl"]

    empty = {
        "portfolio_id": portfolio_id,
        "total_market_value_brl": total_value,
        "by_sector": [],
        "by_country": [],
        "by_asset_class": [],
        "country_coverage": _ZERO,
    }
    if not positions or total_value <= _ZERO:
        return empty

    provider = get_provider(preferred_provider, brapi_key)
    cache = get_cache(redis) if redis else None

    async def fundamentals_for(ticker: str) -> Optional[Fundamentals]:
        if cache:
            cached = await cache.get_fundamentals(ticker)
            if cached is not None:
                return cached
        data = await provider.get_fundamentals(ticker)
        if data is not None and cache:
            await cache.set_fundamentals(data)
        return data

    async def composition_for(ticker: str) -> Optional[FundComposition]:
        if cache:
            cached = await cache.get_fund_composition(ticker)
            if cached is not None:
                return cached
        data = await provider.get_fund_composition(ticker)
        if data is not None and cache:
            await cache.set_fund_composition(data)
        return data

    tickers = [pos["ticker"] for pos in positions]
    fundamentals_map = dict(zip(tickers, await asyncio.gather(*(fundamentals_for(t) for t in tickers))))

    sector_totals: dict[str, Decimal] = {}
    country_totals: dict[str, Decimal] = {}
    asset_class_totals: dict[str, Decimal] = {}
    resolved_country_value = _ZERO

    for pos in positions:
        market_value = pos["market_value_brl"]
        if market_value <= _ZERO:
            continue
        fund = fundamentals_map.get(pos["ticker"])
        quote_type = (fund.quote_type if fund else None) or ""

        if quote_type.upper() in _FUND_QUOTE_TYPES:
            composition = await composition_for(pos["ticker"])
            resolved_country_value += await _distribute_fund(
                market_value, composition, sector_totals, country_totals, asset_class_totals, fundamentals_for,
            )
        else:
            _add(sector_totals, _translate_sector(fund.sector) if fund and fund.sector else _UNCLASSIFIED, market_value)
            _add(asset_class_totals, _EQUITY_LABEL, market_value)
            if fund and fund.country:
                _add(country_totals, _translate_country(fund.country), market_value)
                resolved_country_value += market_value
            else:
                _add(country_totals, _UNMAPPED, market_value)

    def _to_buckets(totals: dict[str, Decimal]) -> list[dict]:
        return [
            {"label": label, "value_brl": value, "weight": value / total_value}
            for label, value in sorted(totals.items(), key=lambda kv: kv[1], reverse=True)
        ]

    return {
        "portfolio_id": portfolio_id,
        "total_market_value_brl": total_value,
        "by_sector": _to_buckets(sector_totals),
        "by_country": _to_buckets(country_totals),
        "by_asset_class": _to_buckets(asset_class_totals),
        "country_coverage": resolved_country_value / total_value,
    }


async def get_consolidated_look_through(
    user_id: uuid.UUID,
    db: AsyncSession,
    redis=None,
    preferred_provider: str = "yahoo",
    brapi_key: Optional[str] = None,
) -> dict:
    """Mesma distribuição de get_portfolio_look_through, somando todas as
    carteiras do usuário — cada carteira é resolvida (e cacheada) de forma
    independente e depois os baldes de setor/país/classe são somados em
    valor absoluto, com os pesos recalculados contra o total combinado."""
    portfolios = await portfolio_service.get_user_portfolios(user_id, db)
    empty = {
        "total_market_value_brl": _ZERO,
        "by_sector": [],
        "by_country": [],
        "by_asset_class": [],
        "country_coverage": _ZERO,
    }
    if not portfolios:
        return empty

    per_portfolio = await asyncio.gather(*(
        get_portfolio_look_through(p.id, user_id, db, redis, preferred_provider, brapi_key)
        for p in portfolios
    ))

    total_value = sum((p["total_market_value_brl"] for p in per_portfolio), _ZERO)
    if total_value <= _ZERO:
        return empty

    sector_totals: dict[str, Decimal] = {}
    country_totals: dict[str, Decimal] = {}
    asset_class_totals: dict[str, Decimal] = {}
    resolved_country_value = _ZERO

    for result in per_portfolio:
        for bucket in result["by_sector"]:
            _add(sector_totals, bucket["label"], bucket["value_brl"])
        for bucket in result["by_country"]:
            _add(country_totals, bucket["label"], bucket["value_brl"])
        for bucket in result["by_asset_class"]:
            _add(asset_class_totals, bucket["label"], bucket["value_brl"])
        resolved_country_value += result["country_coverage"] * result["total_market_value_brl"]

    def _to_buckets(totals: dict[str, Decimal]) -> list[dict]:
        return [
            {"label": label, "value_brl": value, "weight": value / total_value}
            for label, value in sorted(totals.items(), key=lambda kv: kv[1], reverse=True)
        ]

    return {
        "total_market_value_brl": total_value,
        "by_sector": _to_buckets(sector_totals),
        "by_country": _to_buckets(country_totals),
        "by_asset_class": _to_buckets(asset_class_totals),
        "country_coverage": resolved_country_value / total_value,
    }
