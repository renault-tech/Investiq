"""Provider que encadeia dois provedores: tenta o primário, cai para o
secundário no que faltar.

Motivo: Yahoo bloqueia IPs de datacenter com frequência (a Vercel roda em
um), e o provedor único falhava em silêncio — o ativo simplesmente aparecia
sem preço atual, indistinguível de "esse ticker não existe". Brapi cobre B3
com token gratuito; Yahoo cobre o exterior. Encadear os dois faz cada um
tapar o buraco do outro sem o usuário precisar trocar a configuração.
"""
import logging
from typing import Optional

from src.market_data.base import (
    FundComposition,
    Fundamentals,
    HistoricalBar,
    MarketDataProvider,
    Quote,
)

logger = logging.getLogger(__name__)


class FallbackProvider(MarketDataProvider):
    """Tenta `primary`; o que ele não devolver, pede ao `secondary`."""

    def __init__(self, primary: MarketDataProvider, secondary: MarketDataProvider):
        self._primary = primary
        self._secondary = secondary

    @property
    def name(self) -> str:
        return f"{self._primary.name}+{self._secondary.name}"

    async def get_quote(self, ticker: str) -> Optional[Quote]:
        for provider in (self._primary, self._secondary):
            try:
                quote = await provider.get_quote(ticker)
            except Exception:  # provedor fora do ar não pode derrubar a rota
                logger.warning("%s falhou em get_quote(%s)", provider.name, ticker, exc_info=True)
                continue
            # price=0 é o que o Yahoo devolve quando não achou o papel — tratar
            # como ausência, senão o fallback nunca é acionado e a carteira
            # mostra "R$ 0,00" como se o ativo tivesse virado pó.
            if quote is not None and quote.price > 0:
                return quote
        return None

    async def get_quotes(self, tickers: list[str]) -> dict[str, Quote]:
        result: dict[str, Quote] = {}
        try:
            result = {
                t: q
                for t, q in (await self._primary.get_quotes(tickers)).items()
                if q is not None and q.price > 0
            }
        except Exception:
            logger.warning("%s falhou em get_quotes", self._primary.name, exc_info=True)

        missing = [t for t in tickers if t not in result]
        if not missing:
            return result

        try:
            for ticker, quote in (await self._secondary.get_quotes(missing)).items():
                if quote is not None and quote.price > 0:
                    result[ticker] = quote
        except Exception:
            logger.warning("%s falhou em get_quotes (fallback)", self._secondary.name, exc_info=True)
        return result

    async def get_historical(
        self, ticker: str, period: str = "1y", interval: str = "1d"
    ) -> list[HistoricalBar]:
        for provider in (self._primary, self._secondary):
            try:
                bars = await provider.get_historical(ticker, period, interval)
            except Exception:
                logger.warning("%s falhou em get_historical(%s)", provider.name, ticker, exc_info=True)
                continue
            if bars:
                return bars
        return []

    async def get_fundamentals(self, ticker: str) -> Optional[Fundamentals]:
        for provider in (self._primary, self._secondary):
            try:
                fundamentals = await provider.get_fundamentals(ticker)
            except Exception:
                logger.warning("%s falhou em get_fundamentals(%s)", provider.name, ticker, exc_info=True)
                continue
            if fundamentals is not None:
                return fundamentals
        return None

    async def get_fund_composition(self, ticker: str) -> Optional[FundComposition]:
        for provider in (self._primary, self._secondary):
            try:
                composition = await provider.get_fund_composition(ticker)
            except Exception:
                logger.warning("%s falhou em get_fund_composition(%s)", provider.name, ticker, exc_info=True)
                continue
            if composition is not None:
                return composition
        return None
