"""Apuração de ganho de capital para ações brasileiras e FIIs (swing trade).

Escopo deliberadamente restrito: day trade (compra e venda no mesmo dia),
ativos no exterior, cripto, ETFs e renda fixa seguem regras diferentes
(alíquotas, isenções e até o formulário de declaração mudam) e não são
calculados aqui — ver DISCLAIMER em schemas.py, repetido em toda resposta.

Método de custo médio ponderado (o mesmo já usado em
src/portfolio/calculations.py para as posições) — é o método exigido pela
Receita Federal para apuração de ganho de capital em renda variável, não
uma escolha de conveniência técnica.
"""
import calendar
import uuid
from collections import defaultdict
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.portfolio.models import Portfolio, PortfolioPosition
from src.portfolio.calculations import calculate_weighted_average_cost, multiply, subtract

_ZERO = Decimal("0")
STOCK_CLASS = "stock_br"
FII_CLASS = "fii"
TAXED_ASSET_TYPES = {STOCK_CLASS, FII_CLASS}
TAX_RATE = {STOCK_CLASS: Decimal("0.15"), FII_CLASS: Decimal("0.20")}
MONTHLY_EXEMPTION_LIMIT = Decimal("20000")
DARF_CODIGO_RECEITA = {STOCK_CLASS: "6015", FII_CLASS: "6015"}


async def _load_user_positions(user_id: uuid.UUID, db: AsyncSession) -> list[PortfolioPosition]:
    result = await db.execute(
        select(Portfolio)
        .options(
            selectinload(Portfolio.positions).selectinload(PortfolioPosition.asset),
            selectinload(Portfolio.positions).selectinload(PortfolioPosition.transactions),
        )
        .where(Portfolio.user_id == user_id)
    )
    portfolios = result.scalars().all()
    return [pos for p in portfolios for pos in p.positions]


def _group_by_ticker(positions: list[PortfolioPosition]) -> dict[str, dict]:
    """Custo médio é apurado por ativo perante a Receita, não por carteira —
    junta posições do mesmo ticker espalhadas por carteiras/corretoras."""
    by_ticker: dict[str, dict] = {}
    for pos in positions:
        if pos.asset is None or pos.asset.asset_type not in TAXED_ASSET_TYPES:
            continue
        entry = by_ticker.setdefault(pos.asset.ticker, {"asset_type": pos.asset.asset_type, "txns": []})
        entry["txns"].extend(t for t in pos.transactions if t.transaction_type in ("buy", "sell"))
    return by_ticker


def _replay(positions: list[PortfolioPosition], as_of: date | None = None) -> dict:
    """Replay compras/vendas em ordem cronológica com custo médio ponderado,
    somando resultado realizado de venda por (mês, classe de ativo) e
    devolvendo também a posição (qtd/custo) remanescente em `as_of`."""
    by_ticker = _group_by_ticker(positions)
    monthly: dict[tuple[str, str], dict] = defaultdict(lambda: {"total_sales": _ZERO, "gross_result": _ZERO})
    positions_snapshot: dict[str, dict] = {}

    for ticker, entry in by_ticker.items():
        asset_type = entry["asset_type"]
        txns = sorted(entry["txns"], key=lambda t: t.transaction_date)
        qty = _ZERO
        avg_cost = _ZERO
        for txn in txns:
            txn_date = txn.transaction_date.date() if hasattr(txn.transaction_date, "date") else txn.transaction_date
            if as_of is not None and txn_date > as_of:
                break
            unit_price_brl = multiply(txn.unit_price, txn.fx_rate)
            fees_brl = multiply(txn.fees, txn.fx_rate)
            if txn.transaction_type == "buy":
                avg_cost = calculate_weighted_average_cost(qty, avg_cost, txn.quantity, unit_price_brl, fees_brl)
                qty = qty + txn.quantity
            else:  # sell
                # Defensivo: uma venda maior que a posição não deveria existir
                # (o próprio fluxo de registro de transação recusa isso), mas
                # este módulo lê o histórico de forma independente.
                sold_qty = txn.quantity if txn.quantity <= qty else qty
                if sold_qty <= _ZERO:
                    continue
                gross = subtract(multiply(subtract(unit_price_brl, avg_cost), sold_qty), fees_brl)
                sale_value = multiply(unit_price_brl, sold_qty)
                month_key = f"{txn_date.year}-{txn_date.month:02d}"
                bucket = monthly[(month_key, asset_type)]
                bucket["total_sales"] = bucket["total_sales"] + sale_value
                bucket["gross_result"] = bucket["gross_result"] + gross
                qty = qty - sold_qty
        positions_snapshot[ticker] = {
            "asset_type": asset_type,
            "quantity": qty,
            "avg_cost": avg_cost,
            "total_cost": multiply(qty, avg_cost),
        }

    return {"monthly": monthly, "positions": positions_snapshot}


def _carry_forward(monthly: dict[tuple[str, str], dict], up_to_month: str) -> tuple[list[dict], dict[str, Decimal]]:
    """Percorre os meses em ordem cronológica aplicando isenção (só ações,
    só quando o total vendido no mês não passa de R$20 mil E o resultado é
    positivo) e compensação de prejuízo (por classe de ativo, sem misturar
    ações com FIIs — são apurações separadas)."""
    month_keys = sorted({mk for (mk, _ac) in monthly if mk <= up_to_month})
    loss_carry = {STOCK_CLASS: _ZERO, FII_CLASS: _ZERO}
    results: list[dict] = []

    for month_key in month_keys:
        for asset_class in (STOCK_CLASS, FII_CLASS):
            bucket = monthly.get((month_key, asset_class))
            if bucket is None:
                continue
            total_sales = bucket["total_sales"]
            gross_result = bucket["gross_result"]
            loss_in = loss_carry[asset_class]
            exempt = asset_class == STOCK_CLASS and total_sales <= MONTHLY_EXEMPTION_LIMIT and gross_result > _ZERO

            if gross_result < _ZERO:
                taxable_base = _ZERO
                loss_out = loss_in - gross_result  # soma o prejuízo do mês (gross_result é negativo)
                tax_due = _ZERO
            elif exempt:
                taxable_base = _ZERO
                loss_out = loss_in
                tax_due = _ZERO
            else:
                taxable_base = gross_result - loss_in if gross_result > loss_in else _ZERO
                loss_out = loss_in - gross_result if loss_in > gross_result else _ZERO
                tax_due = taxable_base * TAX_RATE[asset_class]

            loss_carry[asset_class] = loss_out
            results.append({
                "month": month_key,
                "asset_class": asset_class,
                "total_sales": total_sales,
                "gross_result": gross_result,
                "exempt": exempt,
                "loss_carried_in": loss_in,
                "taxable_base": taxable_base,
                "tax_rate": TAX_RATE[asset_class],
                "tax_due": tax_due,
                "loss_carried_out": loss_out,
            })

    return results, loss_carry


async def get_apuration(user_id: uuid.UUID, year: int, db: AsyncSession) -> dict:
    positions = await _load_user_positions(user_id, db)
    replayed = _replay(positions)
    all_results, loss_carry_at_year_end = _carry_forward(replayed["monthly"], up_to_month=f"{year}-12")
    year_results = [r for r in all_results if r["month"].startswith(f"{year}-")]
    total_tax_due_year = sum((r["tax_due"] for r in year_results), _ZERO)
    return {
        "year": year,
        "months": year_results,
        "total_tax_due_year": total_tax_due_year,
        "loss_carry_forward_stock_br": loss_carry_at_year_end[STOCK_CLASS],
        "loss_carry_forward_fii": loss_carry_at_year_end[FII_CLASS],
    }


def _darf_due_date(month_key: str) -> date:
    """Vencimento do DARF de ganho de capital em renda variável: último dia
    útil do mês seguinte ao da operação. Aproximado aqui pelo último dia de
    calendário — confirme o dia útil exato no e-CAC antes de pagar."""
    year, month = (int(p) for p in month_key.split("-"))
    if month == 12:
        return date(year + 1, 1, 31)
    next_month = month + 1
    last_day = calendar.monthrange(year, next_month)[1]
    return date(year, next_month, last_day)


async def get_darf_list(user_id: uuid.UUID, year: int, db: AsyncSession) -> dict:
    apuration = await get_apuration(user_id, year, db)
    items = [
        {
            "month": r["month"],
            "asset_class": r["asset_class"],
            "codigo_receita": DARF_CODIGO_RECEITA[r["asset_class"]],
            "competencia": r["month"],
            "valor": r["tax_due"],
            "vencimento": _darf_due_date(r["month"]),
        }
        for r in apuration["months"]
        if r["tax_due"] > _ZERO
    ]
    return {"year": year, "items": items}


async def get_informe(user_id: uuid.UUID, year: int, db: AsyncSession) -> dict:
    positions = await _load_user_positions(user_id, db)

    dividends_total = _ZERO
    dividends_by_asset: dict[str, Decimal] = defaultdict(lambda: _ZERO)
    for pos in positions:
        if pos.asset is None:
            continue
        for txn in pos.transactions:
            if txn.transaction_type != "dividend":
                continue
            txn_date = txn.transaction_date.date() if hasattr(txn.transaction_date, "date") else txn.transaction_date
            if txn_date.year == year:
                dividends_total += txn.total_amount
                dividends_by_asset[pos.asset.ticker] += txn.total_amount

    replayed = _replay(positions)
    sales_stock_br_total = sum(
        (b["total_sales"] for (mk, ac), b in replayed["monthly"].items() if ac == STOCK_CLASS and mk.startswith(f"{year}-")),
        _ZERO,
    )
    sales_fii_total = sum(
        (b["total_sales"] for (mk, ac), b in replayed["monthly"].items() if ac == FII_CLASS and mk.startswith(f"{year}-")),
        _ZERO,
    )

    today = date.today()
    snapshot_date = date(year, 12, 31) if year < today.year else today
    snapshot_positions = _replay(positions, as_of=snapshot_date)["positions"]
    positions_snapshot = [
        {"ticker": ticker, **info} for ticker, info in snapshot_positions.items() if info["quantity"] > _ZERO
    ]

    return {
        "year": year,
        "dividends_total": dividends_total,
        "dividends_by_asset": [
            {"ticker": t, "total": v} for t, v in sorted(dividends_by_asset.items(), key=lambda kv: kv[1], reverse=True)
        ],
        "sales_stock_br_total": sales_stock_br_total,
        "sales_fii_total": sales_fii_total,
        "positions_snapshot": positions_snapshot,
        "snapshot_date": snapshot_date,
    }
