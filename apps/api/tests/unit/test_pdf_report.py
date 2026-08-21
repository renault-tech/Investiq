"""Unit tests for the monthly PDF report — formatting helpers and that the
generator produces a valid, non-trivial PDF for both populated and empty
data (no portfolios, no expenses)."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from decimal import Decimal

from src.reports.pdf_report import _fmt_brl, _fmt_pct, generate_monthly_report_pdf


def test_fmt_brl_uses_ptbr_separators():
    assert _fmt_brl(Decimal("1234.56")) == "R$ 1.234,56"


def test_fmt_brl_negative():
    assert _fmt_brl(Decimal("-42.10")) == "-R$ 42,10"


def test_fmt_brl_small_value_no_thousands_separator():
    assert _fmt_brl(Decimal("9.99")) == "R$ 9,99"


def test_fmt_pct_uses_ptbr_decimal_comma():
    """Era "37.5%": o relatório escrevia moeda com vírgula e percentual com
    ponto, no mesmo documento."""
    assert _fmt_pct(Decimal("0.375")) == "37,5%"
    assert _fmt_pct(Decimal("-0.082")) == "-8,2%"
    assert _fmt_pct(Decimal("1")) == "100,0%"


def test_generate_report_with_data_produces_valid_pdf():
    finance_summary = {
        "income": Decimal("5000.00"), "expense": Decimal("3200.50"), "net": Decimal("1799.50"),
        "by_category": [
            {"category_name": "Moradia", "value": Decimal("1200.00"), "pct": Decimal("0.375")},
        ],
    }
    portfolios = [{
        "portfolio_name": "Principal",
        "total_invested_brl": Decimal("10000.00"),
        "total_market_value_brl": Decimal("11500.00"),
        "total_pnl_absolute": Decimal("1500.00"),
        "total_pnl_percent": Decimal("15.00"),
    }]
    pdf_bytes = generate_monthly_report_pdf(
        user_name="Teste", month="2026-07",
        finance_sections=[("Consolidado", finance_summary)], portfolios=portfolios,
    )
    assert pdf_bytes[:5] == b"%PDF-"
    assert len(pdf_bytes) > 1000


def test_generate_report_with_no_data_still_produces_valid_pdf():
    finance_summary = {"income": Decimal("0"), "expense": Decimal("0"), "net": Decimal("0"), "by_category": []}
    pdf_bytes = generate_monthly_report_pdf(
        user_name="Teste", month="2026-07",
        finance_sections=[("Consolidado", finance_summary)], portfolios=[],
    )
    assert pdf_bytes[:5] == b"%PDF-"


def test_uma_secao_por_carteira_selecionada():
    """Duas carteiras selecionadas geram duas seções — consolidar sempre
    esconderia justamente a comparação que motiva escolhê-las."""
    def _summary(income: str, expense: str) -> dict:
        return {
            "income": Decimal(income), "expense": Decimal(expense),
            "net": Decimal(income) - Decimal(expense), "by_category": [],
        }

    one = generate_monthly_report_pdf(
        user_name="Teste", month="2026-07",
        finance_sections=[("Nubank", _summary("5000", "3000"))], portfolios=[],
    )
    two = generate_monthly_report_pdf(
        user_name="Teste", month="2026-07",
        finance_sections=[("Nubank", _summary("5000", "3000")), ("Itau", _summary("2000", "800"))],
        portfolios=[],
    )
    assert two[:5] == b"%PDF-"
    assert len(two) > len(one)


# --- Seções opcionais e gráficos -------------------------------------------

_SERIES = [
    {"month": f"2026-{m:02d}", "income": Decimal("10000"), "expense": Decimal("7000")}
    for m in range(1, 9)
]

_SUMMARY = {
    "income": Decimal("10000"), "expense": Decimal("7000"), "net": Decimal("3000"),
    "by_category": [
        {"category_name": "Moradia", "value": Decimal("4000"), "pct": Decimal("0.57"), "category_color": "#5A6BF0"},
        {"category_name": "Lazer", "value": Decimal("3000"), "pct": Decimal("0.43"), "category_color": None},
    ],
    "monthly_series": _SERIES,
}

_PORTFOLIOS = [{
    "portfolio_name": "Principal",
    "total_invested_brl": Decimal("10000"),
    "total_market_value_brl": Decimal("11500"),
    "total_pnl_absolute": Decimal("1500"),
    "total_pnl_percent": Decimal("15.00"),
    "allocation_by_type": [
        {"asset_type": "stock_br", "value": Decimal("7000")},
        {"asset_type": "fii", "value": Decimal("4500")},
    ],
}]


def _pdf(**overrides) -> bytes:
    kwargs = dict(
        user_name="Teste", month="2026-08",
        finance_sections=[("Consolidado", _SUMMARY)], portfolios=_PORTFOLIOS,
    )
    kwargs.update(overrides)
    return generate_monthly_report_pdf(**kwargs)


def test_report_omits_investments_section_entirely_when_excluded():
    """A carteira pode ser de outra pessoa: nem o título deve aparecer, senão
    o documento sugere um patrimônio que não é do titular."""
    without = _pdf(include_investments=False)
    with_investments = _pdf(include_investments=True)
    assert without.startswith(b"%PDF")
    assert len(without) < len(with_investments)


def test_report_can_omit_finance_section():
    only_investments = _pdf(include_finance=False)
    assert only_investments.startswith(b"%PDF")
    assert len(only_investments) < len(_pdf())


def test_charts_add_content_and_can_be_disabled():
    assert len(_pdf(include_charts=True)) > len(_pdf(include_charts=False))


def test_report_survives_names_outside_latin1():
    """As fontes embutidas do fpdf2 são latin-1: um travessão ou emoji num
    nome de categoria levantava FPDFUnicodeEncodingException e derrubava a
    geração inteira."""
    summary = dict(_SUMMARY)
    summary["by_category"] = [
        {"category_name": "Lazer — família 🎉", "value": Decimal("500"), "pct": Decimal("1"), "category_color": None},
    ]
    content = _pdf(
        finance_sections=[("Consolidado", summary)],
        portfolios=[{**_PORTFOLIOS[0], "portfolio_name": "Cripto — “longo prazo”"}],
    )
    assert content.startswith(b"%PDF")


def test_report_handles_empty_series_and_zero_values():
    empty = {
        "income": Decimal("0"), "expense": Decimal("0"), "net": Decimal("0"),
        "by_category": [], "monthly_series": [],
    }
    content = _pdf(finance_sections=[("Consolidado", empty)], portfolios=[])
    assert content.startswith(b"%PDF")


def test_charts_do_not_leak_fill_color_into_the_table():
    """O fpdf2 guarda a cor de preenchimento como estado global — sem reset
    depois do gráfico, a tabela saía com a cor da última barra."""
    from fpdf import FPDF
    from src.reports.charts import horizontal_bar_chart

    pdf = FPDF()
    pdf.add_page()
    pdf.set_fill_color(255, 255, 255)
    horizontal_bar_chart(
        pdf,
        items=[{"label": "A", "value": Decimal("10")}],
        label_key="label", value_key="value",
    )
    assert pdf.fill_color.colors255 == (255, 255, 255)


def test_bar_colors_never_repeat_an_explicit_category_color():
    """Duas barras da mesma cor na mesma lista tornam a legenda inútil: uma
    categoria sem cor não pode calhar de receber a cor de outra."""
    from src.reports.charts import CATEGORICAL, resolve_bar_colors

    # A primeira categoria escolhe explicitamente a mesma cor que a paleta
    # daria à segunda por posição.
    explicit = "#{:02X}{:02X}{:02X}".format(*CATEGORICAL[1])
    rows = [
        {"category_color": None},
        {"category_color": explicit},
        {"category_color": None},
    ]
    colors = resolve_bar_colors(rows, "category_color")

    assert colors[1] == CATEGORICAL[1]
    assert len(set(colors)) == len(colors), "duas barras receberam a mesma cor"


def test_bar_colors_respect_explicit_choices():
    from src.reports.charts import resolve_bar_colors

    rows = [{"category_color": "#FF0000"}, {"category_color": "#00FF00"}]
    assert resolve_bar_colors(rows, "category_color") == [(255, 0, 0), (0, 255, 0)]


def test_bar_colors_fall_back_when_every_palette_color_is_taken():
    """Com a paleta inteira já escolhida explicitamente não há cor livre —
    tem que devolver alguma, não estourar."""
    from src.reports.charts import CATEGORICAL, resolve_bar_colors

    rows = [{"c": "#{:02X}{:02X}{:02X}".format(*c)} for c in CATEGORICAL]
    rows.append({"c": None})
    colors = resolve_bar_colors(rows, "c")
    assert len(colors) == len(CATEGORICAL) + 1
    assert colors[-1] in CATEGORICAL
