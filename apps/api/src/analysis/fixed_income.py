"""Fixed income comparator — LCA vs CDB vs Tesouro Direto.

Compares different fixed income instruments on a net-of-tax basis,
normalized to an equivalent annual rate (a.a.) for fair comparison.

Brazilian IR brackets (calendar days):
  ≤ 180d: 22.5%
  ≤ 360d: 20.0%
  ≤ 720d: 17.5%
  > 720d: 15.0%

LCI/LCA/CRI/CRA are IR-exempt.
"""
from decimal import Decimal
from typing import Optional
from dataclasses import dataclass, field

from src.portfolio.calculations import (
    calculate_fixed_income_gross_return,
    calculate_fixed_income_net_return,
    divide,
    multiply,
)
from src.shared.decimal_utils import d, round_financial

_ZERO = Decimal("0")
_ONE = Decimal("1")
_HUNDRED = Decimal("100")


# ---------------------------------------------------------------------------
# Instrument definitions
# ---------------------------------------------------------------------------


@dataclass
class FixedIncomeInstrument:
    """Describes a fixed income instrument to be compared."""
    name: str
    instrument_type: str         # cdb | lca | lci | lca | cri | cra | tesouro_selic | tesouro_ipca | tesouro_prefixado | other
    annual_rate: Decimal         # nominal annual rate in % (e.g. 12.5 = 12.5% a.a.)
    rate_type: str               # prefixado | cdi_pct | ipca_plus | selic_plus
    cdi_pct: Optional[Decimal] = None    # percentage of CDI (e.g. 110 = 110% CDI)
    ipca_spread: Optional[Decimal] = None  # spread above IPCA in % (e.g. 5.5)
    is_ir_exempt: bool = False
    minimum_investment: Decimal = field(default_factory=lambda: Decimal("1000"))
    liquidity_days: Optional[int] = None  # None = holds until maturity


@dataclass
class ComparisonResult:
    """Result of a single instrument comparison."""
    name: str
    instrument_type: str
    annual_rate: Decimal
    rate_type: str
    is_ir_exempt: bool
    gross_return: Decimal
    ir_amount: Decimal
    net_return: Decimal
    net_amount: Decimal          # principal + net_return
    effective_annual_rate: Decimal   # equivalent annual net rate for fair comparison
    ranking: int = 0             # filled by comparator (1 = best net return)


# ---------------------------------------------------------------------------
# Core comparator
# ---------------------------------------------------------------------------


def compare_instruments(
    instruments: list[FixedIncomeInstrument],
    principal: Decimal,
    business_days: int,
    calendar_days: int,
    cdi_rate: Optional[Decimal] = None,
    ipca_rate: Optional[Decimal] = None,
) -> list[ComparisonResult]:
    """Compare multiple fixed income instruments on net-of-tax basis.

    Args:
        instruments: List of instruments to compare.
        principal: Investment amount in BRL.
        business_days: Duration in business days (for interest calculation).
        calendar_days: Duration in calendar days (for IR bracket determination).
        cdi_rate: Current CDI annual rate in % (required for CDI-linked instruments).
        ipca_rate: Current IPCA annual rate in % (required for IPCA-linked instruments).

    Returns:
        List of ComparisonResult sorted by net_return descending (best first).
    """
    results = []

    for instrument in instruments:
        annual_rate = _resolve_annual_rate(instrument, cdi_rate, ipca_rate)
        if annual_rate is None:
            continue

        gross_return = calculate_fixed_income_gross_return(
            principal=principal,
            annual_rate=annual_rate,
            business_days=business_days,
        )

        ir_amount, net_return = calculate_fixed_income_net_return(
            principal=principal,
            gross_return=gross_return,
            days=calendar_days,
            is_ir_exempt=instrument.is_ir_exempt,
        )

        net_amount = principal + net_return
        effective_annual_rate = _effective_annual_rate(net_return, principal, business_days)

        results.append(ComparisonResult(
            name=instrument.name,
            instrument_type=instrument.instrument_type,
            annual_rate=round_financial(annual_rate),
            rate_type=instrument.rate_type,
            is_ir_exempt=instrument.is_ir_exempt,
            gross_return=gross_return,
            ir_amount=ir_amount,
            net_return=net_return,
            net_amount=round_financial(net_amount),
            effective_annual_rate=effective_annual_rate,
        ))

    # Sort by net_return descending; assign ranking
    results.sort(key=lambda r: r.net_return, reverse=True)
    for i, r in enumerate(results):
        r.ranking = i + 1

    return results


def _resolve_annual_rate(
    instrument: FixedIncomeInstrument,
    cdi_rate: Optional[Decimal],
    ipca_rate: Optional[Decimal],
) -> Optional[Decimal]:
    """Compute the effective annual rate for an instrument based on its rate_type."""
    if instrument.rate_type == "prefixado":
        return instrument.annual_rate

    if instrument.rate_type == "cdi_pct":
        if cdi_rate is None:
            return None
        if instrument.cdi_pct is None:
            return None
        # e.g. CDI=10.5% a.a., cdi_pct=110% → effective = 10.5 * 1.10 = 11.55% a.a.
        return multiply(cdi_rate, divide(instrument.cdi_pct, _HUNDRED))

    if instrument.rate_type == "ipca_plus":
        if ipca_rate is None:
            return None
        spread = instrument.ipca_spread or _ZERO
        # Compound: (1 + ipca/100) * (1 + spread/100) - 1, expressed as %
        ipca_factor = _ONE + divide(ipca_rate, _HUNDRED)
        spread_factor = _ONE + divide(spread, _HUNDRED)
        effective = (ipca_factor * spread_factor - _ONE) * _HUNDRED
        return effective

    if instrument.rate_type == "selic_plus":
        if cdi_rate is None:  # Selic ≈ CDI for practical purposes
            return None
        spread = instrument.ipca_spread or _ZERO
        return cdi_rate + spread

    # Fallback: use annual_rate as-is
    return instrument.annual_rate


def _effective_annual_rate(
    net_return: Decimal,
    principal: Decimal,
    business_days: int,
) -> Decimal:
    """Convert net return over the period to an equivalent annual rate (% a.a.).

    Uses 252 business-day year convention.
    Formula: ((1 + net_return/principal) ^ (252 / business_days) - 1) * 100
    """
    if principal == _ZERO or business_days == 0:
        return _ZERO
    period_return = divide(net_return, principal)
    exponent = float(Decimal(252) / Decimal(business_days))
    factor = (1 + float(period_return)) ** exponent
    annual_rate = (Decimal(str(factor)) - _ONE) * _HUNDRED
    return round_financial(annual_rate)


# ---------------------------------------------------------------------------
# Convenience factory for common instruments
# ---------------------------------------------------------------------------


def build_cdb(
    name: str,
    cdi_pct: Decimal,
    minimum_investment: Decimal = Decimal("1000"),
    liquidity_days: Optional[int] = None,
) -> FixedIncomeInstrument:
    """Factory for CDI-linked CDB."""
    return FixedIncomeInstrument(
        name=name,
        instrument_type="cdb",
        annual_rate=_ZERO,  # derived from CDI%
        rate_type="cdi_pct",
        cdi_pct=cdi_pct,
        is_ir_exempt=False,
        minimum_investment=minimum_investment,
        liquidity_days=liquidity_days,
    )


def build_lca(
    name: str,
    cdi_pct: Decimal,
    minimum_investment: Decimal = Decimal("1000"),
    liquidity_days: Optional[int] = 90,
) -> FixedIncomeInstrument:
    """Factory for CDI-linked LCA (IR-exempt, 90-day lock)."""
    return FixedIncomeInstrument(
        name=name,
        instrument_type="lca",
        annual_rate=_ZERO,
        rate_type="cdi_pct",
        cdi_pct=cdi_pct,
        is_ir_exempt=True,
        minimum_investment=minimum_investment,
        liquidity_days=liquidity_days,
    )


def build_lci(
    name: str,
    cdi_pct: Decimal,
    minimum_investment: Decimal = Decimal("1000"),
    liquidity_days: Optional[int] = 90,
) -> FixedIncomeInstrument:
    """Factory for CDI-linked LCI (IR-exempt, 90-day lock)."""
    return FixedIncomeInstrument(
        name=name,
        instrument_type="lci",
        annual_rate=_ZERO,
        rate_type="cdi_pct",
        cdi_pct=cdi_pct,
        is_ir_exempt=True,
        minimum_investment=minimum_investment,
        liquidity_days=liquidity_days,
    )


def build_tesouro_selic(
    name: str = "Tesouro Selic",
    selic_spread: Decimal = _ZERO,
    minimum_investment: Decimal = Decimal("100"),
) -> FixedIncomeInstrument:
    """Factory for Tesouro Selic (Selic + small spread, IR applies)."""
    return FixedIncomeInstrument(
        name=name,
        instrument_type="tesouro_selic",
        annual_rate=_ZERO,
        rate_type="selic_plus",
        ipca_spread=selic_spread,
        is_ir_exempt=False,
        minimum_investment=minimum_investment,
        liquidity_days=1,  # daily liquidity
    )


def build_tesouro_ipca(
    name: str,
    ipca_spread: Decimal,
    minimum_investment: Decimal = Decimal("100"),
    liquidity_days: Optional[int] = None,
) -> FixedIncomeInstrument:
    """Factory for Tesouro IPCA+ (IPCA + spread, IR applies)."""
    return FixedIncomeInstrument(
        name=name,
        instrument_type="tesouro_ipca",
        annual_rate=_ZERO,
        rate_type="ipca_plus",
        ipca_spread=ipca_spread,
        is_ir_exempt=False,
        minimum_investment=minimum_investment,
        liquidity_days=liquidity_days,
    )
