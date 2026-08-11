"""Relatório mensal em Excel — mesmos dados do PDF, mas em células, para
quem quer continuar a conta na planilha em vez de só ler o resultado.

openpyxl (Python puro, sem dependência de sistema) pelo mesmo motivo que o
PDF usa fpdf2: a função da Vercel tem teto de bundle e não comporta as
libs pesadas de planilha.
"""
from datetime import datetime, timezone
from decimal import Decimal
from io import BytesIO

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

_NAVY = "0A192F"
_HEADER_FILL = PatternFill("solid", start_color=_NAVY, end_color=_NAVY)
_HEADER_FONT = Font(bold=True, color="FFFFFF", size=10)
_TITLE_FONT = Font(bold=True, size=14, color=_NAVY)
_SECTION_FONT = Font(bold=True, size=11, color=_NAVY)
_MUTED_FONT = Font(italic=True, size=9, color="64748B")

_BRL = 'R$ #,##0.00'
_PCT = '0.0%'

_MONTH_NAMES_PT = [
    "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]


def _num(value) -> float:
    """openpyxl não serializa Decimal — e gravar texto formatado perderia a
    capacidade de somar na planilha, que é o motivo de existir o Excel."""
    return float(value if value is not None else 0)


def _write_header(ws, row: int, labels: list[str]) -> int:
    for col, label in enumerate(labels, start=1):
        cell = ws.cell(row=row, column=col, value=label)
        cell.fill = _HEADER_FILL
        cell.font = _HEADER_FONT
        cell.alignment = Alignment(horizontal="center")
    return row + 1


def _autosize(ws) -> None:
    for col in ws.columns:
        width = max((len(str(c.value)) for c in col if c.value is not None), default=0)
        ws.column_dimensions[get_column_letter(col[0].column)].width = min(max(width + 4, 12), 48)


def _finance_sheet(wb: Workbook, title: str, summary: dict) -> None:
    ws = wb.create_sheet(title=title[:31])
    ws["A1"] = title
    ws["A1"].font = _SECTION_FONT

    row = 3
    for label, key in (("Receitas", "income"), ("Despesas", "expense"), ("Saldo", "net")):
        ws.cell(row=row, column=1, value=label).font = Font(bold=True, size=10)
        cell = ws.cell(row=row, column=2, value=_num(summary.get(key)))
        cell.number_format = _BRL
        row += 1

    row += 1
    ws.cell(row=row, column=1, value="Despesas por categoria").font = _SECTION_FONT
    row += 1
    by_category = summary.get("by_category") or []
    if by_category:
        row = _write_header(ws, row, ["Categoria", "Valor", "% do mês"])
        for cat in by_category:
            ws.cell(row=row, column=1, value=cat["category_name"])
            ws.cell(row=row, column=2, value=_num(cat["value"])).number_format = _BRL
            ws.cell(row=row, column=3, value=_num(cat["pct"])).number_format = _PCT
            row += 1
    else:
        ws.cell(row=row, column=1, value="Nenhuma despesa registrada neste mês.").font = _MUTED_FONT

    _autosize(ws)


def _portfolios_sheet(wb: Workbook, portfolios: list[dict]) -> None:
    ws = wb.create_sheet(title="Investimentos")
    ws["A1"] = "Investimentos"
    ws["A1"].font = _SECTION_FONT

    row = 3
    if not portfolios:
        ws.cell(row=row, column=1, value="Nenhuma carteira de investimentos selecionada.").font = _MUTED_FONT
        _autosize(ws)
        return

    row = _write_header(ws, row, ["Carteira", "Investido", "Valor atual", "P&L", "P&L %"])
    first_data_row = row
    for p in portfolios:
        ws.cell(row=row, column=1, value=p["portfolio_name"])
        ws.cell(row=row, column=2, value=_num(p["total_invested_brl"])).number_format = _BRL
        ws.cell(row=row, column=3, value=_num(p["total_market_value_brl"])).number_format = _BRL
        ws.cell(row=row, column=4, value=_num(p["total_pnl_absolute"])).number_format = _BRL
        # total_pnl_percent vem em pontos percentuais; o formato de célula do
        # Excel multiplica por 100 de novo, daí a divisão.
        ws.cell(row=row, column=5, value=_num(p["total_pnl_percent"]) / 100).number_format = _PCT
        row += 1

    # Fórmula em vez de valor calculado: quem abrir a planilha e apagar uma
    # linha vê o total se corrigir sozinho, que é o ponto de exportar Excel.
    last = row - 1
    ws.cell(row=row, column=1, value="Total").font = Font(bold=True, size=10)
    for col in (2, 3, 4):
        letter = get_column_letter(col)
        cell = ws.cell(row=row, column=col, value=f"=SUM({letter}{first_data_row}:{letter}{last})")
        cell.number_format = _BRL
        cell.font = Font(bold=True, size=10)

    _autosize(ws)


def generate_monthly_report_xlsx(
    *,
    user_name: str,
    month: str,
    finance_sections: list[tuple[str, dict]],
    portfolios: list[dict],
) -> bytes:
    """finance_sections: (rótulo da carteira, resumo) — uma aba por carteira
    selecionada, ou uma única "Consolidado" quando nenhuma foi escolhida."""
    year, mon = int(month[:4]), int(month[5:7])
    period_label = f"{_MONTH_NAMES_PT[mon]} de {year}"

    wb = Workbook()
    cover = wb.active
    cover.title = "Resumo"
    cover["A1"] = "InvestIQ - Relatório Mensal"
    cover["A1"].font = _TITLE_FONT
    cover["A3"] = "Usuário"
    cover["B3"] = user_name
    cover["A4"] = "Período"
    cover["B4"] = period_label
    cover["A5"] = "Gerado em"
    cover["B5"] = datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M UTC")
    cover["A7"] = (
        "Cotações via fontes públicas gratuitas. "
        "Este relatório não constitui recomendação de investimento."
    )
    cover["A7"].font = _MUTED_FONT
    for row in range(3, 6):
        cover.cell(row=row, column=1).font = Font(bold=True, size=10)
    _autosize(cover)

    for label, summary in finance_sections:
        _finance_sheet(wb, label, summary)
    _portfolios_sheet(wb, portfolios)

    buffer = BytesIO()
    wb.save(buffer)
    return buffer.getvalue()
