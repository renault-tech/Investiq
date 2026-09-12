"""Apuração de ganho de capital (ações BR / FIIs) — isenção de R$20 mil/mês
(só ações, só sobre ganho), alíquotas (15% ações / 20% FII sem isenção) e
compensação de prejuízo por classe de ativo. Constrói objetos leves (sem
banco) com os mesmos atributos que o SQLAlchemy exporia, já que
`_replay`/`_carry_forward` só leem atributos simples."""
from datetime import datetime
from decimal import Decimal
from types import SimpleNamespace

from src.taxes.service import _replay, _carry_forward, STOCK_CLASS, FII_CLASS


def _txn(kind: str, qty: str, price: str, fees: str = "0", when: str = "2026-01-15"):
    return SimpleNamespace(
        transaction_type=kind,
        quantity=Decimal(qty),
        unit_price=Decimal(price),
        fees=Decimal(fees),
        fx_rate=Decimal("1"),
        transaction_date=datetime.fromisoformat(when),
    )


def _position(ticker: str, asset_type: str, txns: list):
    return SimpleNamespace(asset=SimpleNamespace(ticker=ticker, asset_type=asset_type), transactions=txns)


def test_venda_de_acoes_ate_20_mil_com_ganho_e_isenta():
    positions = [_position("PETR4", STOCK_CLASS, [
        _txn("buy", "1000", "10", when="2026-01-05"),
        _txn("sell", "1000", "15", when="2026-01-20"),  # venda total 15.000, ganho 5.000
    ])]
    replayed = _replay(positions)
    results, _ = _carry_forward(replayed["monthly"], up_to_month="2026-12")
    row = results[0]
    assert row["exempt"] is True
    assert row["tax_due"] == Decimal("0")
    assert row["gross_result"] == Decimal("5000")


def test_venda_de_acoes_acima_de_20_mil_paga_15_por_cento():
    positions = [_position("PETR4", STOCK_CLASS, [
        _txn("buy", "2000", "10", when="2026-01-05"),
        _txn("sell", "2000", "15", when="2026-01-20"),  # venda total 30.000, ganho 10.000
    ])]
    replayed = _replay(positions)
    results, _ = _carry_forward(replayed["monthly"], up_to_month="2026-12")
    row = results[0]
    assert row["exempt"] is False
    assert row["gross_result"] == Decimal("10000")
    assert row["tax_due"] == Decimal("1500.00000000")  # 15% de 10.000


def test_fii_nunca_e_isento_mesmo_com_venda_pequena():
    positions = [_position("HGLG11", FII_CLASS, [
        _txn("buy", "10", "100", when="2026-01-05"),
        _txn("sell", "10", "150", when="2026-01-20"),  # venda total 1.500, ganho 500
    ])]
    replayed = _replay(positions)
    results, _ = _carry_forward(replayed["monthly"], up_to_month="2026-12")
    row = results[0]
    assert row["exempt"] is False
    assert row["tax_due"] == Decimal("100.00000000")  # 20% de 500


def test_prejuizo_e_compensado_no_mes_seguinte_mesma_classe():
    positions = [_position("PETR4", STOCK_CLASS, [
        _txn("buy", "2000", "10", when="2026-01-05"),
        _txn("sell", "2000", "8", when="2026-01-20"),  # venda 16.000, prejuízo 4.000
        _txn("buy", "2000", "8", when="2026-02-05"),
        _txn("sell", "2000", "15", when="2026-02-20"),  # venda 30.000, ganho bruto 14.000
    ])]
    replayed = _replay(positions)
    results, final_carry = _carry_forward(replayed["monthly"], up_to_month="2026-12")

    jan, fev = results[0], results[1]
    assert jan["gross_result"] == Decimal("-4000")
    assert jan["loss_carried_out"] == Decimal("4000")
    assert fev["loss_carried_in"] == Decimal("4000")
    assert fev["taxable_base"] == Decimal("10000")  # 14.000 - 4.000 de prejuízo compensado
    assert fev["tax_due"] == Decimal("1500.00000000")  # 15% de 10.000
    assert final_carry[STOCK_CLASS] == Decimal("0")


def test_prejuizo_de_fii_nao_compensa_ganho_de_acao():
    positions = [
        _position("HGLG11", FII_CLASS, [
            _txn("buy", "10", "100", when="2026-01-05"),
            _txn("sell", "10", "50", when="2026-01-20"),  # prejuízo de FII
        ]),
        _position("PETR4", STOCK_CLASS, [
            _txn("buy", "2000", "10", when="2026-02-05"),
            _txn("sell", "2000", "15", when="2026-02-20"),  # ganho de ação, venda 30.000
        ]),
    ]
    replayed = _replay(positions)
    results, _ = _carry_forward(replayed["monthly"], up_to_month="2026-12")
    stock_row = next(r for r in results if r["asset_class"] == STOCK_CLASS)
    assert stock_row["loss_carried_in"] == Decimal("0")
    assert stock_row["tax_due"] == Decimal("1500.00000000")


def test_custo_medio_ponderado_em_duas_compras_antes_da_venda():
    positions = [_position("PETR4", STOCK_CLASS, [
        _txn("buy", "1000", "10", when="2026-01-05"),
        _txn("buy", "1000", "20", when="2026-01-10"),  # custo médio agora 15
        _txn("sell", "2000", "25", when="2026-03-20"),  # fora da isenção: venda 50.000
    ])]
    replayed = _replay(positions)
    results, _ = _carry_forward(replayed["monthly"], up_to_month="2026-12")
    row = results[0]
    # ganho = (25 - 15) * 2000 = 20.000
    assert row["gross_result"] == Decimal("20000")
