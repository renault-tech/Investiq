"""Market data API — per-asset history, technical indicators and fundamentals."""
import logging

from fastapi import APIRouter, Depends, HTTPException, Query

from src.auth.dependencies import get_current_user
from src.auth.models import User
from src.market_data.factory import get_provider, get_cache
from src.market_data.dependencies import get_redis, get_user_provider_settings
from src.market_data.base import is_b3_ticker
from src.market_data.schemas import (
    BarResponse,
    HistoryResponse,
    IndicatorsResponse,
    MaSeries,
    FundamentalsResponse,
    FixedIncomeCompareRequest,
    FixedIncomeComparisonResult,
)
from src.analysis.indicators import (
    get_indicator_bundle,
    calculate_sma,
    calculate_ema,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/market", tags=["market"])

_ALLOWED_PERIODS = {"1mo", "3mo", "6mo", "1y", "2y", "5y", "max"}
_ALLOWED_INTERVALS = {"1d", "1wk"}


async def _fetch_history(
    ticker: str,
    period: str,
    interval: str,
    redis,
    provider_settings: dict,
):
    """Cache-first OHLCV fetch using the user's preferred provider."""
    cache = get_cache(redis) if redis else None
    if cache:
        bars = await cache.get_historical(ticker, period, interval)
        if bars:
            return bars

    provider = get_provider(provider_settings["preferred"], provider_settings["brapi_key"])
    bars = await provider.get_historical(ticker, period, interval)
    if bars and cache:
        await cache.set_historical(ticker, bars, period, interval)
    return bars


@router.get("/assets/{ticker}/history", response_model=HistoryResponse)
async def get_asset_history(
    ticker: str,
    period: str = Query(default="1y"),
    interval: str = Query(default="1d"),
    current_user: User = Depends(get_current_user),
    redis=Depends(get_redis),
    provider_settings: dict = Depends(get_user_provider_settings),
):
    """OHLCV history for a ticker (cache-first)."""
    if period not in _ALLOWED_PERIODS:
        raise HTTPException(status_code=422, detail=f"period must be one of {sorted(_ALLOWED_PERIODS)}")
    if interval not in _ALLOWED_INTERVALS:
        raise HTTPException(status_code=422, detail=f"interval must be one of {sorted(_ALLOWED_INTERVALS)}")

    ticker = ticker.upper().strip()
    bars = await _fetch_history(ticker, period, interval, redis, provider_settings)
    if not bars:
        raise HTTPException(status_code=404, detail=f"Nenhum dado encontrado para {ticker}")

    return HistoryResponse(
        ticker=ticker,
        period=period,
        interval=interval,
        bars=[
            BarResponse(
                date=bar.date, open=bar.open, high=bar.high,
                low=bar.low, close=bar.close, volume=bar.volume,
            )
            for bar in bars
        ],
    )


@router.get("/assets/{ticker}/indicators", response_model=IndicatorsResponse)
async def get_asset_indicators(
    ticker: str,
    period: str = Query(default="1y"),
    rsi_period: int = Query(default=14, ge=2, le=100),
    bb_period: int = Query(default=20, ge=2, le=100),
    sma: str = Query(default="20,50,200", description="CSV of SMA periods"),
    ema: str = Query(default="9,21", description="CSV of EMA periods"),
    current_user: User = Depends(get_current_user),
    redis=Depends(get_redis),
    provider_settings: dict = Depends(get_user_provider_settings),
):
    """Technical indicators (RSI, MACD, Bollinger, SMA/EMA) computed over daily bars."""
    if period not in _ALLOWED_PERIODS:
        raise HTTPException(status_code=422, detail=f"period must be one of {sorted(_ALLOWED_PERIODS)}")

    ticker = ticker.upper().strip()
    bars = await _fetch_history(ticker, period, "1d", redis, provider_settings)
    if not bars:
        raise HTTPException(status_code=404, detail=f"Nenhum dado encontrado para {ticker}")

    def _parse_periods(csv: str, limit: int = 5) -> list[int]:
        periods = []
        for part in csv.split(","):
            part = part.strip()
            if part.isdigit() and 2 <= int(part) <= 500:
                periods.append(int(part))
        return periods[:limit]

    bundle = get_indicator_bundle(bars, rsi_period=rsi_period, bb_period=bb_period)

    sma_series = [
        MaSeries(
            period=p,
            points=[{"date": item["date"], "value": item["sma"]} for item in calculate_sma(bars, p)],
        )
        for p in _parse_periods(sma)
    ]
    ema_series = [
        MaSeries(
            period=p,
            points=[{"date": item["date"], "value": item["ema"]} for item in calculate_ema(bars, p)],
        )
        for p in _parse_periods(ema)
    ]

    return IndicatorsResponse(
        ticker=ticker,
        rsi=bundle.get("rsi", []),
        macd=bundle.get("macd", []),
        bollinger=[
            {"date": item["date"], "upper": item["upper"], "middle": item["middle"], "lower": item["lower"]}
            for item in bundle.get("bollinger", [])
        ],
        sma=sma_series,
        ema=ema_series,
    )


@router.get("/assets/{ticker}/fundamentals", response_model=FundamentalsResponse)
async def get_asset_fundamentals(
    ticker: str,
    current_user: User = Depends(get_current_user),
    redis=Depends(get_redis),
    provider_settings: dict = Depends(get_user_provider_settings),
):
    """Fundamental data, merged from free sources (B3: Brapi + Yahoo; global: Yahoo).

    Every field is optional — the UI renders "indisponível" for missing values.
    """
    ticker = ticker.upper().strip()
    cache = get_cache(redis) if redis else None
    if cache:
        cached = await cache.get_fundamentals(ticker)
        if cached:
            return FundamentalsResponse(**cached.__dict__)

    from src.market_data.yahoo import YahooFinanceProvider
    from src.market_data.brapi import BrapiProvider

    fundamentals = None
    if is_b3_ticker(ticker) and provider_settings["brapi_key"]:
        fundamentals = await BrapiProvider(provider_settings["brapi_key"]).get_fundamentals(ticker)

    yahoo_data = await YahooFinanceProvider().get_fundamentals(ticker)
    if fundamentals is None:
        fundamentals = yahoo_data
    elif yahoo_data is not None:
        # Brapi first for B3; Yahoo fills the gaps per field
        for field, value in yahoo_data.__dict__.items():
            if field != "ticker" and getattr(fundamentals, field) is None and value is not None:
                setattr(fundamentals, field, value)

    if fundamentals is None:
        raise HTTPException(status_code=404, detail=f"Fundamentos indisponíveis para {ticker}")

    if cache:
        await cache.set_fundamentals(fundamentals)

    return FundamentalsResponse(**fundamentals.__dict__)


@router.post("/fixed-income/compare", response_model=list[FixedIncomeComparisonResult])
async def compare_fixed_income(
    body: FixedIncomeCompareRequest,
    current_user: User = Depends(get_current_user),
):
    """Compare fixed-income instruments net of regressive IR (252-business-day convention).

    CDI/IPCA rates are supplied by the caller (free BCB SGS lookup lands with the
    Profit/BCB integration); LCI/LCA are IR-exempt automatically by type.
    """
    from src.analysis.fixed_income import FixedIncomeInstrument, compare_instruments

    if not body.instruments:
        raise HTTPException(status_code=422, detail="Informe ao menos um instrumento")
    if body.business_days <= 0 or body.calendar_days <= 0:
        raise HTTPException(status_code=422, detail="Prazos devem ser positivos")

    instruments = [
        FixedIncomeInstrument(
            name=inst.name,
            instrument_type=inst.instrument_type,
            annual_rate=inst.annual_rate,
            rate_type=inst.rate_type,
            cdi_pct=inst.cdi_pct,
            ipca_spread=inst.ipca_spread,
            is_ir_exempt=inst.is_ir_exempt or inst.instrument_type in ("lci", "lca", "cri", "cra"),
        )
        for inst in body.instruments
    ]

    results = compare_instruments(
        instruments=instruments,
        principal=body.principal,
        business_days=body.business_days,
        calendar_days=body.calendar_days,
        cdi_rate=body.cdi_rate,
        ipca_rate=body.ipca_rate,
    )
    return [FixedIncomeComparisonResult(**r.__dict__) for r in results]
