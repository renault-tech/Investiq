"""Portfolio API router."""
import uuid
import logging

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.auth.dependencies import get_current_user
from src.auth.models import User
from src.market_data.dependencies import get_redis as _get_redis
from src.market_data.dependencies import get_user_provider_settings as _get_user_provider_settings
from src.portfolio import service
from src.portfolio import look_through
from src.shared.csv_export import build_csv_response
from datetime import date as dt_date

from src.portfolio.schemas import (
    PortfolioCreate,
    PortfolioUpdate,
    PortfolioResponse,
    PortfolioSummaryResponse,
    ConsolidatedSummaryResponse,
    PerformancePoint,
    BenchmarkPoint,
    PortfolioIncomeResponse,
    PortfolioLookThroughResponse,
    TransactionCreate,
    TransactionUpdate,
    TransactionResponse,
    AddPositionRequest,
    PortfolioAuditResponse,
    PortfolioRepairResponse,
    UpdatePositionRequest,
    PositionResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/portfolios", tags=["portfolios"])


@router.get("/", response_model=list[PortfolioResponse])
async def list_portfolios(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all portfolios for the current user."""
    return await service.get_user_portfolios(current_user.id, db)


# Registradas antes de /{portfolio_id}/... — "consolidated" bate no mesmo
# formato de rota (dois segmentos depois de /portfolios/), e o roteador
# usa a primeira que casar; se {portfolio_id} viesse antes, "consolidated"
# seria capturado como (inválido) portfolio_id e nunca chegaria aqui.
@router.get("/consolidated/summary", response_model=ConsolidatedSummaryResponse)
async def get_consolidated_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis=Depends(_get_redis),
    provider_settings: dict = Depends(_get_user_provider_settings),
):
    """Resumo somando todas as carteiras do usuário — mesmos números do
    resumo de uma carteira, mas de todas juntas."""
    return await service.get_consolidated_summary(
        user_id=current_user.id,
        db=db,
        redis=redis,
        preferred_provider=provider_settings["preferred"],
        brapi_key=provider_settings["brapi_key"],
    )


@router.get("/consolidated/performance", response_model=list[PerformancePoint])
async def get_consolidated_performance(
    period: str = Query(default="1y", pattern="^(1m|3m|6m|1y|max)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis=Depends(_get_redis),
    provider_settings: dict = Depends(_get_user_provider_settings),
):
    """Valor combinado de todas as carteiras ao longo do tempo — sempre
    reconstruído das transações (nunca lê snapshot, que é por carteira)."""
    return await service.get_consolidated_performance(
        user_id=current_user.id,
        period=period,
        db=db,
        redis=redis,
        preferred_provider=provider_settings["preferred"],
        brapi_key=provider_settings["brapi_key"],
    )


@router.get("/consolidated/benchmark", response_model=list[BenchmarkPoint])
async def get_consolidated_benchmark(
    period: str = Query(default="1y", pattern="^(1m|3m|6m|1y|max)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis=Depends(_get_redis),
    provider_settings: dict = Depends(_get_user_provider_settings),
):
    """Retorno combinado de todas as carteiras vs. CDI, Ibovespa, Nasdaq e S&P 500."""
    return await service.get_consolidated_benchmark(
        user_id=current_user.id,
        period=period,
        db=db,
        redis=redis,
        preferred_provider=provider_settings["preferred"],
        brapi_key=provider_settings["brapi_key"],
    )


@router.post("/", response_model=PortfolioResponse, status_code=status.HTTP_201_CREATED)
async def create_portfolio(
    body: PortfolioCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new portfolio."""
    return await service.create_portfolio(
        current_user.id, body.name, body.description, body.currency, db, holder=body.holder
    )


@router.put("/{portfolio_id}", response_model=PortfolioResponse)
async def update_portfolio(
    portfolio_id: uuid.UUID,
    body: PortfolioUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a portfolio's name, description and/or holder."""
    return await service.update_portfolio(
        portfolio_id, current_user.id, db, body.model_dump(exclude_unset=True)
    )


@router.delete("/{portfolio_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_portfolio(
    portfolio_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a portfolio completely."""
    await service.delete_portfolio(portfolio_id, current_user.id, db)


@router.get("/{portfolio_id}/summary", response_model=PortfolioSummaryResponse)
async def get_portfolio_summary(
    portfolio_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis=Depends(_get_redis),
    provider_settings: dict = Depends(_get_user_provider_settings),
):
    """Get full portfolio summary with live prices, P&L, and rebalance suggestions."""
    data = await service.get_portfolio_summary(
        portfolio_id=portfolio_id,
        user_id=current_user.id,
        db=db,
        redis=redis,
        preferred_provider=provider_settings["preferred"],
        brapi_key=provider_settings["brapi_key"],
    )
    return data


@router.get("/{portfolio_id}/performance", response_model=list[PerformancePoint])
async def get_portfolio_performance(
    portfolio_id: uuid.UUID,
    period: str = Query(default="1y", pattern="^(1m|3m|6m|1y|max)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis=Depends(_get_redis),
    provider_settings: dict = Depends(_get_user_provider_settings),
):
    """Portfolio value over time (snapshots + reconstruction from transactions)."""
    return await service.get_portfolio_performance(
        portfolio_id=portfolio_id,
        user_id=current_user.id,
        period=period,
        db=db,
        redis=redis,
        preferred_provider=provider_settings["preferred"],
        brapi_key=provider_settings["brapi_key"],
    )


@router.get("/{portfolio_id}/benchmark", response_model=list[BenchmarkPoint])
async def get_portfolio_benchmark(
    portfolio_id: uuid.UUID,
    period: str = Query(default="1y", pattern="^(1m|3m|6m|1y|max)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis=Depends(_get_redis),
    provider_settings: dict = Depends(_get_user_provider_settings),
):
    """Portfolio cumulative return vs. CDI, Ibovespa, Nasdaq and S&P 500 over the same window."""
    return await service.get_portfolio_benchmark(
        portfolio_id=portfolio_id,
        user_id=current_user.id,
        period=period,
        db=db,
        redis=redis,
        preferred_provider=provider_settings["preferred"],
        brapi_key=provider_settings["brapi_key"],
    )


@router.get("/{portfolio_id}/look-through", response_model=PortfolioLookThroughResponse)
async def get_portfolio_look_through(
    portfolio_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis=Depends(_get_redis),
    provider_settings: dict = Depends(_get_user_provider_settings),
):
    """Distribuição da carteira por setor, país e classe de ativo, olhando
    através de cada ETF/fundo para suas posições subjacentes."""
    return await look_through.get_portfolio_look_through(
        portfolio_id=portfolio_id,
        user_id=current_user.id,
        db=db,
        redis=redis,
        preferred_provider=provider_settings["preferred"],
        brapi_key=provider_settings["brapi_key"],
    )


@router.get("/{portfolio_id}/income", response_model=PortfolioIncomeResponse)
async def get_portfolio_income(
    portfolio_id: uuid.UUID,
    year: int = Query(default_factory=lambda: dt_date.today().year),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Dividend income: monthly series for `year` + trailing-12m yield-on-cost per asset."""
    return await service.get_portfolio_income(portfolio_id, current_user.id, year, db)


@router.get("/{portfolio_id}/audit", response_model=PortfolioAuditResponse)
async def audit_portfolio(
    portfolio_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Conta aberta de cada posição (quantidade × preço × câmbio) e os
    problemas de base detectados — de onde o total realmente vem."""
    return await service.audit_portfolio(portfolio_id, current_user.id, db)


@router.post("/{portfolio_id}/audit/repair-fx", response_model=PortfolioRepairResponse)
async def repair_portfolio_fx(
    portfolio_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Regrava com o câmbio histórico as transações de ativo estrangeiro
    lançadas com câmbio 1, recalcula as posições afetadas, e limpa os
    snapshots diários da carteira (que confiavam num valor calculado antes
    da correção)."""
    return await service.repair_portfolio_fx(portfolio_id, current_user.id, db)


@router.get("/{portfolio_id}/export")
async def export_portfolio(
    portfolio_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis=Depends(_get_redis),
    provider_settings: dict = Depends(_get_user_provider_settings),
):
    """CSV export of current positions (';' separator, ',' decimal — Excel PT-BR)."""
    summary = await service.get_portfolio_summary(
        portfolio_id=portfolio_id,
        user_id=current_user.id,
        db=db,
        redis=redis,
        preferred_provider=provider_settings["preferred"],
        brapi_key=provider_settings["brapi_key"],
    )
    rows = [
        [
            pos["ticker"], pos["quantity"], pos["avg_cost"], pos["current_price"],
            pos["market_value_brl"], pos["pnl_absolute"], pos["pnl_percent"],
        ]
        for pos in summary["positions"]
    ]
    return build_csv_response(
        f"{summary['portfolio_name']}.csv",
        ["Ativo", "Quantidade", "Preço Médio", "Preço Atual", "Valor de Mercado", "P&L R$", "P&L %"],
        rows,
    )


@router.post("/transactions", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def record_transaction(
    body: TransactionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Record a buy/sell/dividend/split/bonus transaction."""
    txn = await service.record_transaction(
        position_id=body.position_id,
        user_id=current_user.id,
        transaction_type=body.transaction_type,
        quantity=body.quantity,
        unit_price=body.unit_price,
        fees=body.fees,
        fx_rate=body.fx_rate,
        transaction_date=body.transaction_date,
        notes=body.notes,
        db=db,
    )
    return txn


@router.post("/{portfolio_id}/positions", response_model=PositionResponse, status_code=status.HTTP_201_CREATED)
async def add_position_to_portfolio(
    portfolio_id: uuid.UUID,
    body: AddPositionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a new asset position to a portfolio."""
    return await service.add_position(
        portfolio_id=portfolio_id,
        user_id=current_user.id,
        ticker=body.ticker,
        broker=body.broker,
        target_weight=body.target_weight,
        db=db,
        asset_type=body.asset_type,
        name=body.name,
    )


@router.get("/positions/{position_id}/transactions", response_model=list[TransactionResponse])
async def list_position_transactions(
    position_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Histórico de transações de uma posição, mais recente primeiro."""
    return await service.list_position_transactions(position_id, current_user.id, db)


@router.patch("/positions/{position_id}", response_model=PositionResponse)
async def update_position(
    position_id: uuid.UUID,
    body: UpdatePositionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Edita corretora e/ou peso-alvo de uma posição. Quantidade e preço
    médio são derivados das transações — edite ou apague a transação para
    mudá-los."""
    fields = body.model_fields_set
    return await service.update_position(
        position_id=position_id,
        user_id=current_user.id,
        broker=body.broker,
        target_weight=body.target_weight,
        db=db,
        broker_set="broker" in fields,
        target_weight_set="target_weight" in fields,
    )


@router.delete("/positions/{position_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_position(
    position_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove um ativo da carteira — apaga a posição e todo o histórico de
    transações dela junto."""
    await service.delete_position(position_id, current_user.id, db)


@router.patch("/transactions/{transaction_id}", response_model=TransactionResponse)
async def update_transaction(
    transaction_id: uuid.UUID,
    body: TransactionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Corrige uma transação lançada errada (quantidade, preço, data...). A
    posição (quantidade, preço médio) é recalculada a partir do histórico
    inteiro depois da edição."""
    updates = body.model_dump(exclude_unset=True)
    return await service.update_transaction(transaction_id, current_user.id, updates, db)


@router.delete("/transactions/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    transaction_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Apaga uma transação lançada por engano. A posição é recalculada a
    partir do histórico restante."""
    await service.delete_transaction(transaction_id, current_user.id, db)
