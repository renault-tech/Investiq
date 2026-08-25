"""Unit tests for _compute_xirr — the money-weighted return (XIRR) behind
GET /portfolios/{id}/summary's xirr_percent.

XIRR complements TWR: TWR (see test_benchmark.py) measures how the assets
themselves performed, neutralizing when/how much was contributed — good for
comparing against CDI/Ibovespa. XIRR measures how much the investor
personally gained, at the real timing of their own contributions.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from datetime import date
from decimal import Decimal

from src.portfolio.service import _compute_xirr


def test_xirr_none_with_fewer_than_two_flows():
    assert _compute_xirr([]) is None
    assert _compute_xirr([(date(2026, 1, 1), Decimal("-1000"))]) is None


def test_xirr_none_without_a_sign_change():
    # Só aportes, carteira nunca avaliada — sem saque/valor final, não há
    # taxa que zere o valor presente.
    only_outflows = [
        (date(2026, 1, 1), Decimal("-1000")),
        (date(2026, 6, 1), Decimal("-500")),
    ]
    assert _compute_xirr(only_outflows) is None

    only_inflows = [
        (date(2026, 1, 1), Decimal("1000")),
        (date(2026, 6, 1), Decimal("500")),
    ]
    assert _compute_xirr(only_inflows) is None


def test_xirr_matches_a_simple_one_year_10_percent_gain():
    # 1000 aportados, avaliados em 1100 exatamente 365 dias depois (2021, não
    # bissexto): 1000 * (1+r)^(365/365) = 1100 -> r = 10% exato.
    flows = [
        (date(2021, 1, 1), Decimal("-1000")),
        (date(2022, 1, 1), Decimal("1100")),
    ]
    result = _compute_xirr(flows)
    assert result is not None
    assert abs(result - Decimal("10.00")) < Decimal("0.01")


def test_xirr_is_zero_when_final_value_equals_the_contribution():
    flows = [
        (date(2021, 1, 1), Decimal("-1000")),
        (date(2022, 1, 1), Decimal("1000")),
    ]
    result = _compute_xirr(flows)
    assert result is not None
    assert abs(result - Decimal("0")) < Decimal("0.01")


def test_xirr_is_negative_on_a_loss():
    # Perdeu metade em exatamente um ano -> -50% ao ano.
    flows = [
        (date(2021, 1, 1), Decimal("-1000")),
        (date(2022, 1, 1), Decimal("500")),
    ]
    result = _compute_xirr(flows)
    assert result is not None
    assert abs(result - Decimal("-50.00")) < Decimal("0.05")


def test_xirr_handles_unsorted_input():
    # A ordem de entrada não importa — a função ordena por data internamente.
    flows = [
        (date(2022, 1, 1), Decimal("1100")),
        (date(2021, 1, 1), Decimal("-1000")),
    ]
    result = _compute_xirr(flows)
    assert result is not None
    assert abs(result - Decimal("10.00")) < Decimal("0.01")


def test_xirr_with_a_mid_period_contribution_lands_between_the_two_implied_rates():
    # Aporte de 1000 no início, mais 1000 aportados 6 meses depois (quando o
    # primeiro já tinha virado 1100 — 10% em meio ano), carteira fechando o
    # ano em 2300. Sem calcular o valor exato à mão, o XIRR tem que ficar
    # positivo e num intervalo plausível (entre 0% e 100% ao ano) — serve
    # pra travar que a função não diverge nem devolve algo fora da realidade
    # nesse cenário com mais de dois fluxos.
    flows = [
        (date(2021, 1, 1), Decimal("-1000")),
        (date(2021, 7, 2), Decimal("-1000")),
        (date(2022, 1, 1), Decimal("2300")),
    ]
    result = _compute_xirr(flows)
    assert result is not None
    assert Decimal("0") < result < Decimal("100")


def test_xirr_accounts_for_a_sell_as_a_positive_flow_before_the_final_valuation():
    # Compra 1000, vende metade (600, com ganho) 6 meses depois, resto vale
    # 600 no fim do ano. Só precisa ser positivo (houve ganho líquido) e
    # plausível — o objetivo é travar que uma venda no meio do caminho é
    # tratada como entrada de caixa, não ignorada.
    flows = [
        (date(2021, 1, 1), Decimal("-1000")),
        (date(2021, 7, 2), Decimal("600")),
        (date(2022, 1, 1), Decimal("600")),
    ]
    result = _compute_xirr(flows)
    assert result is not None
    assert result > Decimal("0")
