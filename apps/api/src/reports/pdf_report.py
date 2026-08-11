"""Monthly PDF report — personal finance summary + consolidated portfolio
positions for a given month. Built with fpdf2 (pure Python, no system
dependencies like Cairo/Pango — keeps the Docker image simple).
"""
from datetime import datetime, timezone
from decimal import Decimal

from fpdf import FPDF

_NAVY = (10, 25, 47)  # #0A192F — matches the web app's institutional navy
_ACCENT = (5, 150, 105)  # emerald
_DANGER = (220, 38, 38)
_MUTED = (100, 116, 139)
_MONTH_NAMES_PT = [
    "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]


def _fmt_brl(value: Decimal) -> str:
    """R$ 1.234,56 — Brazilian thousands/decimal separators."""
    quantized = value.quantize(Decimal("0.01"))
    sign = "-" if quantized < 0 else ""
    whole, _, cents = f"{abs(quantized):.2f}".partition(".")
    grouped = f"{int(whole):,}".replace(",", ".")
    return f"{sign}R$ {grouped},{cents}"


def _fmt_pct(fraction: Decimal) -> str:
    return f"{(fraction * 100).quantize(Decimal('0.1'))}%"


class _ReportPDF(FPDF):
    def header(self):
        self.set_font("helvetica", "B", 16)
        self.set_text_color(*_NAVY)
        self.cell(0, 10, "InvestIQ - Relatório Mensal", new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(*_NAVY)
        self.line(10, 20, 200, 20)
        self.ln(4)

    def footer(self):
        self.set_y(-15)
        self.set_font("helvetica", "I", 7)
        self.set_text_color(*_MUTED)
        self.cell(
            0, 8,
            "Cotações via fontes públicas gratuitas. Este relatório não constitui recomendação de investimento.",
            align="C",
        )

    def section_title(self, text: str):
        self.ln(2)
        self.set_font("helvetica", "B", 12)
        self.set_text_color(*_NAVY)
        self.cell(0, 8, text, new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(*_MUTED)
        self.set_line_width(0.2)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(3)

    def stat_row(self, stats: list[tuple[str, str, tuple[int, int, int]]]):
        col_width = 190 / len(stats)
        self.set_font("helvetica", "", 9)
        for label, _, _ in stats:
            self.set_text_color(*_MUTED)
            self.cell(col_width, 5, label, align="C")
        self.ln(5)
        for _, value, color in stats:
            self.set_font("helvetica", "B", 13)
            self.set_text_color(*color)
            self.cell(col_width, 8, value, align="C")
        self.ln(10)


def generate_monthly_report_pdf(
    *,
    user_name: str,
    month: str,
    finance_sections: list[tuple[str, dict]],
    portfolios: list[dict],
) -> bytes:
    """Render the report to PDF bytes.

    finance_sections: (rótulo da carteira, resumo) — uma seção por carteira
    selecionada, ou uma única "Consolidado" quando nenhuma foi escolhida.
    Cada resumo tem o shape de finance.service.get_summary().
    portfolios: list of {portfolio_name, currency, ...totals} — one dict per
    portfolio, each shaped like portfolio.service.get_portfolio_summary()'s
    top-level totals (total_invested_brl, total_market_value_brl,
    total_pnl_absolute, total_pnl_percent).
    """
    year, mon = int(month[:4]), int(month[5:7])
    period_label = f"{_MONTH_NAMES_PT[mon]} de {year}"

    pdf = _ReportPDF()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()

    pdf.set_font("helvetica", "", 10)
    pdf.set_text_color(*_MUTED)
    generated_at = datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M UTC")
    pdf.cell(0, 6, f"{user_name}  -  Período: {period_label}  -  Gerado em {generated_at}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    # --- Finanças pessoais -------------------------------------------------
    for label, finance_summary in finance_sections:
        title = "Finanças pessoais" if label == "Consolidado" else f"Finanças pessoais - {label}"
        pdf.section_title(title)
        income = finance_summary["income"]
        expense = finance_summary["expense"]
        net = finance_summary["net"]
        pdf.stat_row([
            ("Receitas", _fmt_brl(income), _ACCENT),
            ("Despesas", _fmt_brl(expense), _DANGER),
            ("Saldo", _fmt_brl(net), _ACCENT if net >= 0 else _DANGER),
        ])

        by_category = finance_summary.get("by_category") or []
        if by_category:
            pdf.set_font("helvetica", "B", 9)
            pdf.set_text_color(*_NAVY)
            with pdf.table(col_widths=(90, 50, 50), text_align=("LEFT", "RIGHT", "RIGHT")) as table:
                header = table.row()
                for text in ("Categoria", "Valor", "% do mês"):
                    header.cell(text)
                pdf.set_font("helvetica", "", 9)
                for cat in by_category:
                    row = table.row()
                    row.cell(cat["category_name"])
                    row.cell(_fmt_brl(cat["value"]))
                    row.cell(_fmt_pct(cat["pct"]))
        else:
            pdf.set_font("helvetica", "I", 9)
            pdf.set_text_color(*_MUTED)
            pdf.cell(0, 6, "Nenhuma despesa registrada neste mês.", new_x="LMARGIN", new_y="NEXT")

    # --- Investimentos -------------------------------------------------
    pdf.section_title("Investimentos")
    if portfolios:
        total_invested = sum((p["total_invested_brl"] for p in portfolios), Decimal("0"))
        total_market_value = sum((p["total_market_value_brl"] for p in portfolios), Decimal("0"))
        total_pnl = sum((p["total_pnl_absolute"] for p in portfolios), Decimal("0"))
        total_pnl_pct = (total_pnl / total_invested) if total_invested > 0 else Decimal("0")
        pdf.stat_row([
            ("Total investido", _fmt_brl(total_invested), _NAVY),
            ("Valor de mercado", _fmt_brl(total_market_value), _NAVY),
            ("P&L", f"{_fmt_brl(total_pnl)} ({_fmt_pct(total_pnl_pct)})", _ACCENT if total_pnl >= 0 else _DANGER),
        ])

        pdf.set_font("helvetica", "B", 9)
        pdf.set_text_color(*_NAVY)
        with pdf.table(
            col_widths=(60, 45, 45, 40), text_align=("LEFT", "RIGHT", "RIGHT", "RIGHT")
        ) as table:
            header = table.row()
            for text in ("Carteira", "Investido", "Valor atual", "P&L"):
                header.cell(text)
            pdf.set_font("helvetica", "", 9)
            for p in portfolios:
                row = table.row()
                row.cell(p["portfolio_name"])
                row.cell(_fmt_brl(p["total_invested_brl"]))
                row.cell(_fmt_brl(p["total_market_value_brl"]))
                row.cell(f"{_fmt_brl(p['total_pnl_absolute'])} ({_fmt_pct(p['total_pnl_percent'] / 100)})")
    else:
        pdf.set_font("helvetica", "I", 9)
        pdf.set_text_color(*_MUTED)
        pdf.cell(0, 6, "Nenhuma carteira de investimentos selecionada.", new_x="LMARGIN", new_y="NEXT")

    return bytes(pdf.output())
