"""Analytics de fatura — agregação por categoria e achados."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

import uuid
from datetime import date
from decimal import Decimal

from src.cards.analytics import (
    _category_breakdown,
    _findings,
    _history_totals_by_category,
    _totals_by_category,
)


_DEFAULT_DATE = object()  # sentinela: permite passar purchase_date=None de propósito


class _Item:
    def __init__(self, description, amount, purchase_date=_DEFAULT_DATE, installment_no=None,
                 category_id=None, is_ignored=False):
        self.description = description
        self.amount = Decimal(str(amount))
        self.purchase_date = date(2026, 6, 10) if purchase_date is _DEFAULT_DATE else purchase_date
        self.installment_no = installment_no
        self.category_id = category_id
        self.is_ignored = is_ignored


class _Invoice:
    def __init__(self, items):
        self.items = items


def test_totals_by_category_skips_ignored_items():
    cat = uuid.uuid4()
    totals = _totals_by_category([
        _Item("A", 100, category_id=cat),
        _Item("B", 50, category_id=cat),
        _Item("Ignorado", 999, category_id=cat, is_ignored=True),
    ])
    assert totals[cat] == Decimal("150")


def test_three_identical_charges_are_one_finding_not_two():
    # O agrupamento é por (descrição, valor, data): três cobranças iguais são
    # UM achado que fala em três, não dois achados repetidos.
    items = [_Item("MERCADO SILVA", 152.30) for _ in range(3)]
    out = [f for f in _findings(items, _totals_by_category(items), {}, {}, 0) if f["kind"] == "duplicate"]
    assert len(out) == 1
    assert "3 vezes" in out[0]["description"]
    # O valor do achado é o excedente (2 cobranças a mais), não o total nem uma só.
    assert out[0]["amount"] == Decimal("304.60")


def test_items_without_a_purchase_date_are_not_flagged_as_duplicates():
    # O extrator admite não achar a data. Sem ela, dois lançamentos sem
    # relação nenhuma não podem ser acusados de cair "no mesmo dia".
    items = [_Item("POSTO", 100, purchase_date=None), _Item("POSTO", 100, purchase_date=None)]
    out = [f for f in _findings(items, _totals_by_category(items), {}, {}, 0) if f["kind"] == "duplicate"]
    assert out == []


def test_installments_are_not_flagged_as_duplicates():
    # Parcela tem installment_no — mesma descrição e valor é o esperado.
    items = [_Item("TV 10X", 200, installment_no=n) for n in (1, 2, 3)]
    out = [f for f in _findings(items, _totals_by_category(items), {}, {}, 0) if f["kind"] == "duplicate"]
    assert out == []


def test_category_spike_needs_at_least_two_past_invoices():
    cat = uuid.uuid4()
    items = [_Item("Viagem", 1000, category_id=cat)]
    current = _totals_by_category(items)
    hist = {cat: [Decimal("100")]}
    # Com uma fatura só de histórico não dá pra falar em desvio de padrão.
    assert [f for f in _findings(items, current, hist, {cat: "Lazer"}, 1) if f["kind"] == "category_spike"] == []
    spikes = [f for f in _findings(items, current, {cat: [Decimal("100"), Decimal("100")]},
                                   {cat: "Lazer"}, 2) if f["kind"] == "category_spike"]
    assert len(spikes) == 1
    assert spikes[0]["title"] == "Lazer acima do normal"


def test_uncategorized_items_are_reported_together():
    items = [_Item("A", 10), _Item("B", 20), _Item("C", 30, category_id=uuid.uuid4())]
    out = [f for f in _findings(items, _totals_by_category(items), {}, {}, 0) if f["kind"] == "uncategorized"]
    assert len(out) == 1
    assert out[0]["amount"] == Decimal("30")
    assert "2 lançamento" in out[0]["title"]


def test_breakdown_delta_is_none_without_history():
    cat = uuid.uuid4()
    items = [_Item("A", 100, category_id=cat)]
    out = _category_breakdown(_totals_by_category(items), {}, {cat: "Alimentação"})
    assert out[0]["delta_pct"] is None  # sem histórico não se inventa 0%
    assert out[0]["category"] == "Alimentação"


def test_breakdown_delta_compares_against_history_average():
    cat = uuid.uuid4()
    items = [_Item("A", 150, category_id=cat)]
    hist = _history_totals_by_category([
        _Invoice([_Item("A", 100, category_id=cat)]),
        _Invoice([_Item("A", 100, category_id=cat)]),
    ])
    out = _category_breakdown(_totals_by_category(items), hist, {cat: "Alimentação"})
    assert out[0]["delta_pct"] == Decimal("50")


def test_history_does_not_fill_missing_categories_with_zero():
    # Categoria que só aparece numa das faturas antigas não deve ter a média
    # puxada para baixo por zeros — senão toda categoria nova parece estourada.
    cat = uuid.uuid4()
    hist = _history_totals_by_category([
        _Invoice([_Item("A", 100, category_id=cat)]),
        _Invoice([_Item("Outra", 80)]),
    ])
    assert hist[cat] == [Decimal("100")]
