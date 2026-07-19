"""Banco Central do Brasil — SGS (Sistema Gerenciador de Séries Temporais).

Free, no-auth API used for the CDI daily rate that backs the portfolio
benchmark feature. See docs/specs/2026-07-12-data-sources-free.md.
"""
import json
import logging
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

import httpx

logger = logging.getLogger(__name__)

SGS_BASE_URL = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.{code}/dados"
CDI_SERIES = 12  # "Taxa de juros - CDI", % ao dia

_CDI_CACHE_TTL = 43200  # 12h — daily series, per the documented cache policy


async def fetch_sgs_series(code: int, start: date, end: date) -> list[tuple[date, Decimal]]:
    """Raw fetch of a BCB SGS series between two dates (inclusive)."""
    params = {
        "formato": "json",
        "dataInicial": start.strftime("%d/%m/%Y"),
        "dataFinal": end.strftime("%d/%m/%Y"),
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(SGS_BASE_URL.format(code=code), params=params)
        resp.raise_for_status()
        data = resp.json()

    points = []
    for item in data:
        try:
            points.append((
                datetime.strptime(item["data"], "%d/%m/%Y").date(),
                Decimal(item["valor"]),
            ))
        except (KeyError, ValueError, InvalidOperation):
            continue
    return points


async def get_cdi_daily_rates(start: date, end: date, redis=None) -> list[tuple[date, Decimal]]:
    """Daily CDI rate (% per business day) for [start, end], cache-first.

    Never raises — returns an empty list on any failure so the benchmark
    endpoint can degrade that leg to null instead of failing the whole
    response, the same posture as a missing live quote elsewhere in
    market_data/.
    """
    cache_key = f"bcb:cdi:{start.isoformat()}:{end.isoformat()}"
    if redis is not None:
        try:
            cached = await redis.get(cache_key)
            if cached:
                return [(date.fromisoformat(d), Decimal(v)) for d, v in json.loads(cached)]
        except Exception as exc:
            logger.warning("BCB CDI cache read failed: %s", exc)

    try:
        rates = await fetch_sgs_series(CDI_SERIES, start, end)
    except Exception as exc:
        logger.warning("BCB CDI fetch failed: %s", exc)
        return []

    if redis is not None and rates:
        try:
            payload = json.dumps([[d.isoformat(), str(v)] for d, v in rates])
            await redis.setex(cache_key, _CDI_CACHE_TTL, payload)
        except Exception as exc:
            logger.warning("BCB CDI cache write failed: %s", exc)

    return rates
