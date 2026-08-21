"""Gráficos do relatório em PDF, desenhados com as primitivas do fpdf2.

Sem matplotlib de propósito. O relatório precisa de três formas simples
(barras agrupadas, barras horizontais e uma linha), e matplotlib traria
NumPy junto — dezenas de MB num deploy que já estourou o limite de 225 MB
de função da Vercel uma vez. Retângulo e linha resolvem, e o resultado
combina melhor com a identidade do documento.

Todo texto de valor passa pelos formatadores em padrão brasileiro.
"""
from decimal import Decimal
from typing import Optional, Sequence

from fpdf import FPDF

# Paleta categórica — as mesmas cores da web, na mesma ordem, para o
# relatório e a tela não contarem a história com cores diferentes.
CATEGORICAL: list[tuple[int, int, int]] = [
    (16, 185, 129),   # esmeralda
    (90, 107, 240),   # índigo
    (245, 158, 11),   # âmbar
    (236, 72, 153),   # rosa
    (14, 165, 233),   # azul-céu
    (168, 85, 247),   # violeta
    (249, 115, 22),   # laranja
    (20, 184, 166),   # turquesa
]

_INK = (10, 25, 47)
_MUTED = (100, 116, 139)
_GRID = (226, 232, 240)
_INCOME = (16, 185, 129)
_EXPENSE = (239, 68, 68)

_MONTH_ABBR_PT = ["", "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]

# As fontes embutidas do fpdf2 são latin-1. Rótulo de categoria é texto que o
# usuário escreveu: um travessão ou emoji no nome levantaria
# FPDFUnicodeEncodingException e derrubaria o relatório inteiro.
_LATIN1_FALLBACK = str.maketrans({
    "\u2014": "-", "\u2013": "-", "\u2018": "'", "\u2019": "'",
    "\u201c": '"', "\u201d": '"', "\u2026": "...", "\u00a0": " ",
})


def _latin1(text: str) -> str:
    return text.translate(_LATIN1_FALLBACK).encode("latin-1", "replace").decode("latin-1")


def _hex_to_rgb(value: Optional[str]) -> Optional[tuple[int, int, int]]:
    if not value or not isinstance(value, str):
        return None
    raw = value.strip().lstrip("#")
    if len(raw) == 3:
        raw = "".join(c * 2 for c in raw)
    if len(raw) != 6:
        return None
    try:
        return (int(raw[0:2], 16), int(raw[2:4], 16), int(raw[4:6], 16))
    except ValueError:
        return None


def _short_month(month_key: str) -> str:
    """'2026-06' -> 'jun'. Rótulo curto porque cabem 12 num eixo de 190mm."""
    try:
        return _MONTH_ABBR_PT[int(month_key[5:7])]
    except (ValueError, IndexError):
        return month_key[-2:]


def _fmt_axis(value: Decimal) -> str:
    """Rótulo de eixo — compacto, em padrão brasileiro."""
    v = float(value)
    if abs(v) >= 1_000_000:
        return f"{v / 1_000_000:.1f}".replace(".", ",") + " mi"
    if abs(v) >= 1_000:
        return f"{v / 1_000:.0f} mil"
    return f"{v:.0f}"


def _fmt_brl_short(value: Decimal) -> str:
    v = float(value)
    sign = "-" if v < 0 else ""
    v = abs(v)
    if v >= 1_000_000:
        return f"{sign}R$ {v / 1_000_000:.1f}".replace(".", ",") + " mi"
    if v >= 1_000:
        return f"{sign}R$ {v / 1_000:.1f}".replace(".", ",") + " mil"
    return f"{sign}R$ {v:.0f}"


def resolve_bar_colors(
    rows: Sequence[dict], color_key: Optional[str]
) -> list[tuple[int, int, int]]:
    """Uma cor por linha, todas distintas entre si sempre que possível.

    A cor escolhida pelo usuário para a categoria tem prioridade. As demais
    recebem cores da paleta que **nenhuma** categoria explícita já usou —
    sem isso, uma categoria sem cor podia calhar de receber exatamente a cor
    de outra logo abaixo, e as duas barras ficavam indistinguíveis.
    """
    explicit = {
        rgb
        for row in rows
        if color_key and (rgb := _hex_to_rgb(row.get(color_key))) is not None
    }
    available = [c for c in CATEGORICAL if c not in explicit] or CATEGORICAL

    colors: list[tuple[int, int, int]] = []
    fallback_index = 0
    for row in rows:
        chosen = _hex_to_rgb(row.get(color_key)) if color_key else None
        if chosen is None:
            chosen = available[fallback_index % len(available)]
            fallback_index += 1
        colors.append(chosen)
    return colors


def _reset_style(pdf: FPDF) -> None:
    """Devolve cor e espessura ao padrão do documento.

    O fpdf2 guarda fill/draw/line como estado global: sem isso a tabela
    desenhada logo depois de um gráfico saía com o preenchimento da última
    barra (uma tabela roxa de borda verde) e a espessura da última linha.
    """
    pdf.set_fill_color(255, 255, 255)
    pdf.set_draw_color(*_INK)
    pdf.set_text_color(*_INK)
    pdf.set_line_width(0.2)


def _legend(pdf: FPDF, entries: Sequence[tuple[str, tuple[int, int, int]]], x: float, y: float) -> None:
    pdf.set_font("helvetica", "", 7)
    cursor = x
    for label, color in entries:
        pdf.set_fill_color(*color)
        pdf.rect(cursor, y, 3, 3, style="F")
        pdf.set_text_color(*_MUTED)
        pdf.set_xy(cursor + 4, y - 0.6)
        width = pdf.get_string_width(label) + 6
        pdf.cell(width, 4, _latin1(label))
        cursor += width + 4


def grouped_bar_chart(
    pdf: FPDF,
    *,
    series: Sequence[dict],
    height: float = 42.0,
    width: float = 190.0,
) -> None:
    """Receitas x despesas por mês — duas barras por período.

    `series`: [{"month": "2026-06", "income": Decimal, "expense": Decimal}]
    """
    series = [s for s in series if s]
    if not series:
        return

    peak = max(
        (max(Decimal(s.get("income") or 0), Decimal(s.get("expense") or 0)) for s in series),
        default=Decimal("0"),
    )
    if peak <= 0:
        pdf.set_font("helvetica", "I", 8)
        pdf.set_text_color(*_MUTED)
        pdf.cell(0, 6, "Sem movimentação no período.", new_x="LMARGIN", new_y="NEXT")
        return

    left = pdf.l_margin
    top = pdf.get_y()
    axis_width = 16.0
    plot_left = left + axis_width
    plot_width = width - axis_width
    baseline = top + height

    # Grade horizontal com o valor à esquerda — sem ela não dá para estimar
    # nenhuma barra, só comparar umas com as outras.
    pdf.set_draw_color(*_GRID)
    pdf.set_line_width(0.15)
    pdf.set_font("helvetica", "", 6.5)
    for step in range(5):
        fraction = step / 4
        y = baseline - height * fraction
        pdf.line(plot_left, y, plot_left + plot_width, y)
        pdf.set_text_color(*_MUTED)
        pdf.set_xy(left, y - 2)
        pdf.cell(axis_width - 2, 4, _fmt_axis(peak * Decimal(str(fraction))), align="R")

    slot = plot_width / len(series)
    bar_width = min(slot * 0.3, 7.0)
    gap = bar_width * 0.18

    for index, point in enumerate(series):
        center = plot_left + slot * (index + 0.5)
        income = Decimal(point.get("income") or 0)
        expense = Decimal(point.get("expense") or 0)

        for value, color, offset in (
            (income, _INCOME, -(bar_width + gap) / 2),
            (expense, _EXPENSE, (bar_width + gap) / 2),
        ):
            bar_height = float(height * float(value) / float(peak)) if peak else 0.0
            if bar_height <= 0:
                continue
            pdf.set_fill_color(*color)
            pdf.rect(center + offset - bar_width / 2, baseline - bar_height, bar_width, bar_height, style="F")

        pdf.set_font("helvetica", "", 6.5)
        pdf.set_text_color(*_MUTED)
        pdf.set_xy(center - slot / 2, baseline + 1)
        pdf.cell(slot, 4, _short_month(point.get("month", "")), align="C")

    # Eixo base
    pdf.set_draw_color(*_MUTED)
    pdf.set_line_width(0.2)
    pdf.line(plot_left, baseline, plot_left + plot_width, baseline)

    _legend(pdf, [("Receitas", _INCOME), ("Despesas", _EXPENSE)], plot_left, baseline + 6)
    pdf.set_y(baseline + 12)
    _reset_style(pdf)


def horizontal_bar_chart(
    pdf: FPDF,
    *,
    items: Sequence[dict],
    label_key: str,
    value_key: str,
    color_key: Optional[str] = None,
    limit: int = 8,
    width: float = 190.0,
    row_height: float = 6.5,
) -> None:
    """Ranking — despesas por categoria, alocação por classe.

    Barra horizontal em vez de pizza de propósito: comparar comprimentos é
    mais preciso que comparar ângulos, e o rótulo cabe ao lado sem legenda
    separada.
    """
    rows = [i for i in items if Decimal(i.get(value_key) or 0) > 0][:limit]
    if not rows:
        pdf.set_font("helvetica", "I", 8)
        pdf.set_text_color(*_MUTED)
        pdf.cell(0, 6, "Nada a exibir neste período.", new_x="LMARGIN", new_y="NEXT")
        return

    peak = max(Decimal(r.get(value_key) or 0) for r in rows)
    left = pdf.l_margin
    label_width = 44.0
    value_width = 26.0
    track_width = width - label_width - value_width

    colors = resolve_bar_colors(rows, color_key)

    for index, row in enumerate(rows):
        y = pdf.get_y()
        value = Decimal(row.get(value_key) or 0)
        color = colors[index]

        pdf.set_font("helvetica", "", 7.5)
        pdf.set_text_color(*_INK)
        pdf.set_xy(left, y)
        label = _latin1(str(row.get(label_key) or "-"))
        # Trunca no que cabe; sem isso o rótulo invade a barra.
        while label and pdf.get_string_width(label) > label_width - 3:
            label = label[:-1]
        pdf.cell(label_width, row_height, label)

        # Trilho de fundo, para a barra ter escala visível mesmo quando curta.
        pdf.set_fill_color(*_GRID)
        pdf.rect(left + label_width, y + 1.4, track_width, row_height - 3, style="F")

        bar_width = track_width * (float(value) / float(peak)) if peak > 0 else 0
        if bar_width > 0:
            pdf.set_fill_color(*color)
            pdf.rect(left + label_width, y + 1.4, bar_width, row_height - 3, style="F")

        pdf.set_font("helvetica", "B", 7.5)
        pdf.set_text_color(*_INK)
        pdf.set_xy(left + label_width + track_width, y)
        pdf.cell(value_width, row_height, _fmt_brl_short(value), align="R")
        pdf.set_y(y + row_height)

    pdf.ln(2)
    _reset_style(pdf)


def line_chart(
    pdf: FPDF,
    *,
    series: Sequence[dict],
    value_key: str,
    label_key: str = "month",
    color: tuple[int, int, int] = _INCOME,
    height: float = 36.0,
    width: float = 190.0,
    zero_baseline: bool = True,
) -> None:
    """Evolução ao longo do tempo — saldo mensal, proventos acumulados.

    Com `zero_baseline`, o eixo inclui o zero e ganha uma linha de
    referência: num gráfico de saldo, esconder o zero faz um mês negativo
    parecer só "mais baixo" em vez de no vermelho.
    """
    points = [s for s in series if s]
    if len(points) < 2:
        return

    values = [float(p.get(value_key) or 0) for p in points]
    top_value = max(values + ([0.0] if zero_baseline else []))
    bottom_value = min(values + ([0.0] if zero_baseline else []))
    span = top_value - bottom_value
    if span == 0:
        span = abs(top_value) or 1.0

    left = pdf.l_margin
    top = pdf.get_y()
    axis_width = 16.0
    plot_left = left + axis_width
    plot_width = width - axis_width
    baseline = top + height

    def y_for(value: float) -> float:
        return baseline - height * ((value - bottom_value) / span)

    pdf.set_draw_color(*_GRID)
    pdf.set_line_width(0.15)
    pdf.set_font("helvetica", "", 6.5)
    for step in range(4):
        fraction = step / 3
        value = bottom_value + span * fraction
        y = y_for(value)
        pdf.line(plot_left, y, plot_left + plot_width, y)
        pdf.set_text_color(*_MUTED)
        pdf.set_xy(left, y - 2)
        pdf.cell(axis_width - 2, 4, _fmt_axis(Decimal(str(value))), align="R")

    if zero_baseline and bottom_value < 0 < top_value:
        pdf.set_draw_color(*_MUTED)
        pdf.set_line_width(0.25)
        zero_y = y_for(0.0)
        pdf.line(plot_left, zero_y, plot_left + plot_width, zero_y)

    step_x = plot_width / (len(points) - 1)
    pdf.set_draw_color(*color)
    pdf.set_line_width(0.6)
    for index in range(len(points) - 1):
        pdf.line(
            plot_left + step_x * index, y_for(values[index]),
            plot_left + step_x * (index + 1), y_for(values[index + 1]),
        )

    pdf.set_fill_color(*color)
    for index, value in enumerate(values):
        pdf.circle(x=plot_left + step_x * index - 0.7, y=y_for(value) - 0.7, radius=0.7, style="F")

    pdf.set_font("helvetica", "", 6.5)
    pdf.set_text_color(*_MUTED)
    # Um rótulo a cada dois pontos quando são muitos, senão eles se sobrepõem.
    stride = 2 if len(points) > 8 else 1
    for index, point in enumerate(points):
        if index % stride:
            continue
        pdf.set_xy(plot_left + step_x * index - 6, baseline + 1)
        pdf.cell(12, 4, _short_month(str(point.get(label_key, ""))), align="C")

    pdf.set_y(baseline + 8)
    _reset_style(pdf)
