"""Pydantic schemas for the tax (IR) module — apuração, DARF, informe."""
from datetime import date
from decimal import Decimal

from src.shared.schema_base import AppModel as BaseModel

DISCLAIMER = (
    "Cálculo cobre apenas ações brasileiras e FIIs em operações comuns (swing trade), pelo método de "
    "custo médio ponderado exigido pela Receita Federal. Day trade (compra e venda no mesmo dia), ativos "
    "no exterior, criptomoedas, ETFs e renda fixa não entram nesta apuração — confira-os separadamente. "
    "Não substitui a orientação de um contador."
)


class MonthlyTaxResult(BaseModel):
    month: str
    asset_class: str
    total_sales: Decimal
    gross_result: Decimal
    exempt: bool
    loss_carried_in: Decimal
    taxable_base: Decimal
    tax_rate: Decimal
    tax_due: Decimal
    loss_carried_out: Decimal


class TaxApurationResponse(BaseModel):
    year: int
    months: list[MonthlyTaxResult]
    total_tax_due_year: Decimal
    loss_carry_forward_stock_br: Decimal
    loss_carry_forward_fii: Decimal
    disclaimer: str = DISCLAIMER


class DarfItem(BaseModel):
    month: str
    asset_class: str
    codigo_receita: str
    competencia: str
    valor: Decimal
    vencimento: date


class DarfResponse(BaseModel):
    year: int
    items: list[DarfItem]
    disclaimer: str = (
        DISCLAIMER
        + " Vencimento aproximado pelo último dia de calendário do mês seguinte; confirme o dia útil exato "
        "e o código de receita no e-CAC antes de pagar."
    )


class DividendByAsset(BaseModel):
    ticker: str
    total: Decimal


class PositionSnapshot(BaseModel):
    ticker: str
    asset_type: str
    quantity: Decimal
    avg_cost: Decimal
    total_cost: Decimal


class InformeRendimentosResponse(BaseModel):
    year: int
    dividends_total: Decimal
    dividends_by_asset: list[DividendByAsset]
    sales_stock_br_total: Decimal
    sales_fii_total: Decimal
    positions_snapshot: list[PositionSnapshot]
    snapshot_date: date
    disclaimer: str = DISCLAIMER
