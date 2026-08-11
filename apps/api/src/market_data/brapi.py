"""Brapi.dev provider for Brazilian stocks and FIIs."""
import asyncio
from decimal import Decimal, InvalidOperation
from typing import Optional
import logging

import httpx

from src.market_data.base import MarketDataProvider, Quote, HistoricalBar, Fundamentals

logger = logging.getLogger(__name__)

BRAPI_BASE = "https://brapi.dev/api"


def _to_decimal(value) -> Optional[Decimal]:
    if value is None:
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None


class BrapiProvider(MarketDataProvider):
    """Brapi.dev provider — free tier supports 15 req/min."""

    def __init__(self, api_key: Optional[str] = None):
        self._api_key = api_key
        self._client = httpx.AsyncClient(timeout=10.0)

    @property
    def name(self) -> str:
        return "brapi"

    def _params(self, extra: dict | None = None) -> dict:
        params = {}
        if self._api_key:
            params["token"] = self._api_key
        if extra:
            params.update(extra)
        return params

    async def get_quote(self, ticker: str) -> Optional[Quote]:
        quotes = await self.get_quotes([ticker])
        return quotes.get(ticker)

    async def get_quotes(self, tickers: list[str]) -> dict[str, Quote]:
        if not tickers:
            return {}
        result = await self._get_quotes_batch(tickers)
        if result or len(tickers) == 1:
            return result
        # O endpoint devolve erro para o lote inteiro se um único símbolo for
        # desconhecido (papel novo, delistado, ou grafado errado), zerando a
        # cotação de todos os outros junto. Quando o lote falha por completo,
        # perguntar um a um isola o símbolo ruim.
        recovered: dict[str, Quote] = {}
        for ticker in tickers:
            recovered.update(await self._get_quotes_batch([ticker]))
        return recovered

    async def _get_quotes_batch(self, tickers: list[str]) -> dict[str, Quote]:
        tickers_str = ",".join(tickers)
        try:
            resp = await self._client.get(
                f"{BRAPI_BASE}/quote/{tickers_str}",
                params=self._params(),
            )
            resp.raise_for_status()
            data = resp.json()
            results = data.get("results", [])
            result = {}
            for item in results:
                symbol = item.get("symbol")
                price = _to_decimal(item.get("regularMarketPrice"))
                if not symbol or price is None:
                    continue
                change_pct = _to_decimal(item.get("regularMarketChangePercent"))
                result[symbol] = Quote(
                    ticker=symbol,
                    price=price,
                    currency="BRL",
                    change_pct=change_pct,
                    volume=item.get("regularMarketVolume"),
                    market_cap=_to_decimal(item.get("marketCap")),
                )
            return result
        except Exception as exc:
            logger.error("Brapi quote failed for %s: %s", tickers, exc)
            return {}

    async def get_fundamentals(self, ticker: str) -> Optional[Fundamentals]:
        """Fetch fundamentals from Brapi.

        Uses `fundamental=true` (free tier: priceEarnings, earningsPerShare) and
        best-effort extra modules — paid-only modules are silently ignored so the
        free tier never errors out.
        """
        try:
            resp = await self._client.get(
                f"{BRAPI_BASE}/quote/{ticker}",
                params=self._params({
                    "fundamental": "true",
                    "modules": "summaryProfile,defaultKeyStatistics,financialData",
                }),
            )
            resp.raise_for_status()
            results = resp.json().get("results", [])
            if not results:
                return None
            item = results[0]

            profile = item.get("summaryProfile") or {}
            key_stats = item.get("defaultKeyStatistics") or {}
            financial = item.get("financialData") or {}

            price = _to_decimal(item.get("regularMarketPrice"))
            lpa = _to_decimal(item.get("earningsPerShare")) or _to_decimal(key_stats.get("trailingEps"))
            vpa = _to_decimal(key_stats.get("bookValue"))
            p_vp = _to_decimal(key_stats.get("priceToBook"))
            if p_vp is None and price is not None and vpa is not None and vpa != 0:
                p_vp = price / vpa

            return Fundamentals(
                ticker=ticker,
                name=item.get("longName") or item.get("shortName"),
                sector=profile.get("sector"),
                market_cap=_to_decimal(item.get("marketCap")),
                p_l=_to_decimal(item.get("priceEarnings")),
                p_vp=p_vp,
                dividend_yield=_to_decimal(key_stats.get("dividendYield")),
                roe=_to_decimal(financial.get("returnOnEquity")),
                net_margin=_to_decimal(financial.get("profitMargins")),
                lpa=lpa,
                vpa=vpa,
                revenue_ttm=_to_decimal(financial.get("totalRevenue")),
                net_income_ttm=None,
                week52_high=_to_decimal(item.get("fiftyTwoWeekHigh")),
                week52_low=_to_decimal(item.get("fiftyTwoWeekLow")),
            )
        except Exception as exc:
            logger.warning("Brapi fundamentals failed for %s: %s", ticker, exc)
            return None

    async def get_historical(
        self,
        ticker: str,
        period: str = "1y",
        interval: str = "1d",
    ) -> list[HistoricalBar]:
        try:
            resp = await self._client.get(
                f"{BRAPI_BASE}/quote/{ticker}",
                params=self._params({"range": period, "interval": interval, "fundamental": "false"}),
            )
            resp.raise_for_status()
            data = resp.json()
            results = data.get("results", [])
            if not results:
                return []
            history = results[0].get("historicalDataPrice", [])
            bars = []
            from datetime import datetime
            for bar in history:
                date_ts = bar.get("date")
                if date_ts is None:
                    continue
                date = datetime.utcfromtimestamp(date_ts)
                bars.append(HistoricalBar(
                    ticker=ticker,
                    date=date,
                    open=_to_decimal(bar.get("open")) or Decimal("0"),
                    high=_to_decimal(bar.get("high")) or Decimal("0"),
                    low=_to_decimal(bar.get("low")) or Decimal("0"),
                    close=_to_decimal(bar.get("close")) or Decimal("0"),
                    volume=int(bar.get("volume") or 0),
                    adjusted_close=_to_decimal(bar.get("adjustedClose")),
                ))
            return bars
        except Exception as exc:
            logger.error("Brapi history failed for %s: %s", ticker, exc)
            return []
