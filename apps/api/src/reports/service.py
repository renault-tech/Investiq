"""Monthly report assembly — pulls the same data the finance summary and
portfolio summary endpoints already compute, then hands it to the PDF or
XLSX renderer. No new aggregation logic duplicated here."""
import csv
import io
import re
import uuid
from datetime import datetime
from typing import Optional, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.finance.service import get_summary as get_finance_summary, list_accounts, list_transactions
from src.portfolio.service import get_user_portfolios, get_portfolio_summary, get_consolidated_benchmark
from src.reports.models import GeneratedReport
from src.reports.pdf_report import generate_monthly_report_pdf
from src.reports.xlsx_report import generate_monthly_report_xlsx
from src.shared.csv_export import build_csv_bytes, format_csv_cell
from src.shared.exceptions import NotFoundError, ValidationError
from src.taxes import service as taxes_service
from src.taxes.schemas import DISCLAIMER as TAX_DISCLAIMER

_MONTH_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")

FORMATS = {
    "pdf": ("application/pdf", "pdf"),
    "xlsx": ("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"),
}

CSV_CONTENT_TYPE = "text/csv; charset=utf-8"

_SOURCE_LABELS = {
    "manual": "Manual",
    "import_ofx": "Importado (OFX)",
    "import_csv": "Importado (CSV)",
    "card_invoice": "Fatura de cartão",
    "installment": "Parcelamento",
}


async def _finance_sections(
    user_id: uuid.UUID,
    month: str,
    db: AsyncSession,
    account_ids: Optional[Sequence[uuid.UUID]],
) -> list[tuple[str, dict]]:
    """Uma seção por carteira escolhida — ou uma só, consolidada, quando
    nenhuma foi. Consolidar sempre esconderia justamente a comparação entre
    carteiras que motiva escolhê-las."""
    if not account_ids:
        return [("Consolidado", await get_finance_summary(user_id, month, db))]

    accounts = {a["id"]: a for a in await list_accounts(user_id, db, include_inactive=True)}
    unknown = [str(a) for a in account_ids if a not in accounts]
    if unknown:
        raise ValidationError(f"Carteira não encontrada: {', '.join(unknown)}")

    return [
        (accounts[account_id]["name"], await get_finance_summary(user_id, month, db, account_id=account_id))
        for account_id in account_ids
    ]


async def generate_monthly_report(
    user_id: uuid.UUID,
    user_name: str,
    month: str,
    db: AsyncSession,
    redis=None,
    preferred_provider: str = "yahoo",
    brapi_key: Optional[str] = None,
    fmt: str = "pdf",
    account_ids: Optional[Sequence[uuid.UUID]] = None,
    portfolio_ids: Optional[Sequence[uuid.UUID]] = None,
    include_finance: bool = True,
    include_investments: bool = True,
    include_charts: bool = True,
) -> bytes:
    if not _MONTH_RE.match(month):
        raise ValidationError("month deve estar no formato YYYY-MM")
    if fmt not in FORMATS:
        raise ValidationError(f"format deve ser um de: {', '.join(FORMATS)}")

    if not include_finance and not include_investments:
        raise ValidationError("Selecione ao menos uma seção para o relatório.")

    # Cada seção desmarcada é uma consulta a menos: montar finanças para
    # depois descartar custaria o mesmo que gerar o relatório inteiro.
    finance_sections = (
        await _finance_sections(user_id, month, db, account_ids) if include_finance else []
    )

    if not include_investments:
        return _render(
            fmt,
            user_name=user_name,
            month=month,
            finance_sections=finance_sections,
            portfolios=[],
            include_finance=include_finance,
            include_investments=False,
            include_charts=include_charts,
        )

    portfolios = await get_user_portfolios(user_id, db)
    if portfolio_ids:
        wanted = set(portfolio_ids)
        unknown = wanted - {p.id for p in portfolios}
        if unknown:
            raise ValidationError(
                f"Carteira de investimentos não encontrada: {', '.join(str(p) for p in unknown)}"
            )
        portfolios = [p for p in portfolios if p.id in wanted]

    portfolio_summaries = [
        await get_portfolio_summary(
            portfolio_id=p.id,
            user_id=user_id,
            db=db,
            redis=redis,
            preferred_provider=preferred_provider,
            brapi_key=brapi_key,
        )
        for p in portfolios
    ]

    return _render(
        fmt,
        user_name=user_name,
        month=month,
        finance_sections=finance_sections,
        portfolios=portfolio_summaries,
        include_finance=include_finance,
        include_investments=True,
        include_charts=include_charts,
    )


def _render(fmt: str, **kwargs) -> bytes:
    renderer = generate_monthly_report_xlsx if fmt == "xlsx" else generate_monthly_report_pdf
    return renderer(**kwargs)


# ---------------------------------------------------------------------------
# Extrato consolidado (CSV de todas as transações financeiras no período)
# ---------------------------------------------------------------------------

async def generate_consolidated_statement(
    user_id: uuid.UUID, date_from: Optional[datetime], date_to: Optional[datetime], db: AsyncSession,
) -> bytes:
    listing = await list_transactions(user_id, db, date_from=date_from, date_to=date_to, per_page=100_000)
    rows = [
        [
            item["transaction_date"].strftime("%d/%m/%Y"),
            item["transaction_type"],
            item["description"] or "",
            item["category_name"] or "",
            item["amount"],
            item["currency"],
            item["bank_account_name"] or "",
            _SOURCE_LABELS.get(item["source"], item["source"]),
        ]
        for item in listing["items"]
    ]
    return build_csv_bytes(
        ["Data", "Tipo", "Descrição", "Categoria", "Valor", "Moeda", "Conta", "Origem"], rows
    )


# ---------------------------------------------------------------------------
# Rentabilidade vs benchmarks (CSV da série consolidada vs CDI/Ibov/Nasdaq/S&P)
# ---------------------------------------------------------------------------

async def generate_benchmark_report(
    user_id: uuid.UUID, period: str, db: AsyncSession, redis=None,
    preferred_provider: str = "yahoo", brapi_key: Optional[str] = None,
) -> bytes:
    points = await get_consolidated_benchmark(user_id, period, db, redis, preferred_provider, brapi_key)
    rows = [
        [
            p["date"].strftime("%d/%m/%Y") if hasattr(p["date"], "strftime") else p["date"],
            p["portfolio_pct"], p.get("cdi_pct"), p.get("ibov_pct"), p.get("nasdaq_pct"), p.get("sp500_pct"),
        ]
        for p in points
    ]
    return build_csv_bytes(
        ["Data", "Carteira %", "CDI %", "Ibovespa %", "Nasdaq %", "S&P 500 %"], rows
    )


# ---------------------------------------------------------------------------
# Relatório fiscal (CSV combinando apuração mensal, DARF e informe de rendimentos)
# ---------------------------------------------------------------------------

async def generate_tax_report(user_id: uuid.UUID, year: int, db: AsyncSession) -> bytes:
    apuration = await taxes_service.get_apuration(user_id, year, db)
    darf = await taxes_service.get_darf_list(user_id, year, db)
    informe = await taxes_service.get_informe(user_id, year, db)

    lines: list[list] = [[f"Impostos & IR — {year}"], []]
    lines.append(["Apuração mensal (ações BR e FIIs, operações comuns)"])
    lines.append(["Mês", "Classe", "Vendido", "Resultado", "Isento", "Base tributável", "Imposto"])
    for r in apuration["months"]:
        lines.append([
            r["month"], r["asset_class"], r["total_sales"], r["gross_result"],
            "sim" if r["exempt"] else "não", r["taxable_base"], r["tax_due"],
        ])
    lines.append([])
    lines.append(["DARF do ano"])
    lines.append(["Competência", "Classe", "Código", "Vencimento (aprox.)", "Valor"])
    for item in darf["items"]:
        lines.append([
            item["competencia"], item["asset_class"], item["codigo_receita"],
            item["vencimento"].strftime("%d/%m/%Y") if hasattr(item["vencimento"], "strftime") else item["vencimento"],
            item["valor"],
        ])
    lines.append([])
    lines.append(["Informe de rendimentos"])
    lines.append(["Dividendos recebidos", informe["dividends_total"]])
    lines.append(["Total vendido — Ações BR", informe["sales_stock_br_total"]])
    lines.append(["Total vendido — FIIs", informe["sales_fii_total"]])
    lines.append([])
    lines.append(["Posição no fim do período (bens e direitos)"])
    lines.append(["Ativo", "Classe", "Quantidade", "Custo total"])
    for p in informe["positions_snapshot"]:
        lines.append([p["ticker"], p["asset_type"], p["quantity"], p["total_cost"]])
    lines.append([])
    lines.append([TAX_DISCLAIMER])

    # Linhas com contagem de colunas variável — build_csv_bytes espera um
    # header fixo, então monta a linha crua com csv.writer diretamente aqui
    # em vez de forçar todo relatório fiscal no molde de tabela única.
    buffer = io.StringIO()
    buffer.write("﻿")
    writer = csv.writer(buffer, delimiter=";")
    for line in lines:
        writer.writerow([format_csv_cell(cell) for cell in line])
    return buffer.getvalue().encode("utf-8")


# ---------------------------------------------------------------------------
# Persistência — histórico de relatórios gerados
# ---------------------------------------------------------------------------

async def save_generated_report(
    user_id: uuid.UUID, report_type: str, fmt: str, params: dict, file_name: str, content: bytes, db: AsyncSession,
) -> GeneratedReport:
    report = GeneratedReport(
        user_id=user_id, report_type=report_type, format=fmt, params=params,
        file_name=file_name, file_content=content, file_size=len(content),
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return report


async def list_generated_reports(user_id: uuid.UUID, db: AsyncSession, limit: int = 30) -> list[GeneratedReport]:
    result = await db.execute(
        select(GeneratedReport)
        .where(GeneratedReport.user_id == user_id)
        .order_by(GeneratedReport.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def get_generated_report(report_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> GeneratedReport:
    result = await db.execute(
        select(GeneratedReport).where(GeneratedReport.id == report_id, GeneratedReport.user_id == user_id)
    )
    report = result.scalar_one_or_none()
    if report is None:
        raise NotFoundError(f"Relatório {report_id} não encontrado")
    return report


async def delete_generated_report(report_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> None:
    report = await get_generated_report(report_id, user_id, db)
    await db.delete(report)
    await db.commit()
