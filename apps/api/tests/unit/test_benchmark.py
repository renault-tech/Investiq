"""Unit tests for the CDI-compounding and point-in-time lookup helpers behind
GET /portfolios/{id}/benchmark (portfolio vs. CDI/Ibovespa)."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from datetime import date
from decimal import Decimal

from src.portfolio.service import _compound_index, _compute_twr_series, _value_at


def test_compound_index_compounds_daily_rates():
    rates = [
        (date(2026, 1, 1), Decimal("0.05")),
        (date(2026, 1, 2), Decimal("0.05")),
    ]
    index = _compound_index(rates)
    assert index[0] == (date(2026, 1, 1), Decimal("1.0005"))
    assert index[1] == (date(2026, 1, 2), Decimal("1.0005") * Decimal("1.0005"))


def test_compound_index_sorts_out_of_order_input():
    rates = [
        (date(2026, 1, 2), Decimal("0.10")),
        (date(2026, 1, 1), Decimal("0.10")),
    ]
    index = _compound_index(rates)
    assert [d for d, _ in index] == [date(2026, 1, 1), date(2026, 1, 2)]


def test_compound_index_empty_input():
    assert _compound_index([]) == []


def test_value_at_returns_latest_on_or_before():
    series = [(date(2026, 1, 1), Decimal("1")), (date(2026, 1, 5), Decimal("2"))]
    assert _value_at(series, date(2026, 1, 3)) == Decimal("1")
    assert _value_at(series, date(2026, 1, 5)) == Decimal("2")
    assert _value_at(series, date(2026, 1, 10)) == Decimal("2")


def test_value_at_returns_none_before_first_point():
    series = [(date(2026, 1, 5), Decimal("2"))]
    assert _value_at(series, date(2026, 1, 1)) is None


def test_value_at_empty_series():
    assert _value_at([], date(2026, 1, 1)) is None


# --- TWR (time-weighted return) --------------------------------------------
#
# O bug que essas cobrem: comparar a carteira com CDI/Ibovespa usando
# `valor_atual / valor_inicial - 1` fazia um aporte no meio do período
# aparecer como retorno — quem deposita R$ 1.000 vê a linha da carteira
# saltar, mesmo sem nenhum ganho real ter acontecido naquele dia.

def _point(day: date, value: str, invested: str) -> dict:
    return {"date": day, "total_value": Decimal(value), "total_invested": Decimal(invested)}


def test_twr_first_point_is_always_zero_baseline():
    series = [_point(date(2026, 1, 1), "1000", "1000")]
    result = _compute_twr_series(series)
    assert result == [{"date": date(2026, 1, 1), "twr_pct": Decimal("0")}]


def test_twr_empty_series():
    assert _compute_twr_series([]) == []


def test_twr_matches_simple_return_when_there_is_no_cash_flow():
    # Sem aporte nem saque, TWR tem que bater com o retorno simples — é
    # exatamente o caso que o código antigo já acertava.
    series = [
        _point(date(2026, 1, 1), "1000", "1000"),
        _point(date(2026, 1, 2), "1100", "1000"),
        _point(date(2026, 1, 3), "1210", "1000"),
    ]
    result = _compute_twr_series(series)
    assert result[1]["twr_pct"] == Decimal("10.00")
    assert result[2]["twr_pct"] == Decimal("21.00")


def test_twr_does_not_inflate_return_on_a_mid_period_deposit():
    """O cenário exato do bug relatado: valorização de 10%, depois um aporte
    de R$ 1.000 (comprado a preço justo, sem ganho instantâneo), depois mais
    10% de valorização. Retorno simples leria isso como +110% no dia do
    aporte; TWR precisa mostrar só os 10% + 10% de valorização real."""
    series = [
        _point(date(2026, 1, 1), "1000", "1000"),   # base
        _point(date(2026, 1, 2), "1100", "1000"),   # +10% de preço
        _point(date(2026, 1, 3), "2100", "2000"),   # aporte de 1000, preço parado
        _point(date(2026, 1, 4), "2310", "2000"),   # +10% de preço sobre a base maior
    ]
    result = _compute_twr_series(series)

    assert result[1]["twr_pct"] == Decimal("10.00")
    # O aporte não pode aparecer como ganho — continua em 10%, não salta pra 110%.
    assert result[2]["twr_pct"] == Decimal("10.00")
    # 1.10 * 1.10 - 1 = 21%, não 15,5% (que seria a média ingênua) nem 131%
    # (que seria o retorno simples sobre o valor final).
    assert result[3]["twr_pct"] == Decimal("21.00")


def test_twr_handles_a_withdrawal_without_reading_it_as_a_loss():
    series = [
        _point(date(2026, 1, 1), "1000", "1000"),
        _point(date(2026, 1, 2), "1100", "1000"),  # +10%
        # Saca 500 ao preço de mercado do dia anterior (1100): sobra 600 de
        # valor e 500 de custo — nem ganho nem perda, só saída de capital.
        _point(date(2026, 1, 3), "600", "500"),
        _point(date(2026, 1, 4), "660", "500"),    # +10% sobre o que sobrou
    ]
    result = _compute_twr_series(series)
    assert result[1]["twr_pct"] == Decimal("10.00")
    # cash_flow = 500 - 1000 = -500; sub_retorno = (600 - (-500)) / 1100 - 1 = 0%
    assert result[2]["twr_pct"] == Decimal("10.00")
    assert result[3]["twr_pct"] == Decimal("21.00")


def test_twr_pauses_compounding_through_a_fully_cashed_out_gap():
    """Depois de zerar a carteira (vende tudo ao preço de custo — sem ganho
    nem perda), não há base (valor anterior = 0) pra medir o retorno do
    passo que reinveste. O composto fica parado nesse ponto e só volta a
    render a partir de onde o valor positivo reaparece."""
    series = [
        _point(date(2026, 1, 1), "1000", "1000"),
        _point(date(2026, 1, 2), "0", "0"),        # zera a carteira, sem ganho/perda
        _point(date(2026, 1, 3), "500", "500"),    # reinveste
        _point(date(2026, 1, 4), "550", "500"),    # +10% sobre o reinvestimento
    ]
    result = _compute_twr_series(series)
    assert result[1]["twr_pct"] == Decimal("0")
    assert result[2]["twr_pct"] == Decimal("0")
    assert result[3]["twr_pct"] == Decimal("10.00")


def test_twr_single_point_series_has_only_the_baseline():
    result = _compute_twr_series([_point(date(2026, 1, 1), "1000", "1000")])
    assert len(result) == 1
    assert result[0]["twr_pct"] == Decimal("0")
