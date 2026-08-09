"""Finance API router — categories, transactions, monthly summary."""
import re
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.auth.dependencies import get_current_user
from src.auth.models import User
from src.finance import service
from src.finance import import_service
from src.shared.csv_export import build_csv_response
from src.shared.limiter import limiter
from src.finance.schemas import (
    CategoryCreate,
    CategoryUpdate,
    CategoryResponse,
    TransactionCreate,
    TransactionUpdate,
    TransactionResponse,
    TransactionListResponse,
    FinanceSummaryResponse,
    BudgetUpsert,
    BudgetResponse,
    GoalCreate,
    GoalUpdate,
    GoalContributeRequest,
    GoalContributionResponse,
    GoalResponse,
    AccountCreate,
    AccountUpdate,
    AccountResponse,
    ImportBatchResponse,
    ImportRowUpdate,
    ImportRowResponse,
    ImportConfirmResponse,
)

router = APIRouter(prefix="/finance", tags=["finance"])

_MONTH_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


# ---------------------------------------------------------------------------
# Categories
# ---------------------------------------------------------------------------

@router.get("/categories", response_model=list[CategoryResponse])
async def list_categories(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List the user's categories (seeds PT-BR defaults on first access)."""
    return await service.list_categories(current_user.id, db)


@router.post("/categories", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    body: CategoryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.create_category(
        current_user.id, body.name, body.category_type, body.color, body.icon, db
    )


@router.patch("/categories/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: uuid.UUID,
    body: CategoryUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.update_category(
        category_id, current_user.id, body.model_dump(exclude_unset=True), db
    )


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await service.delete_category(category_id, current_user.id, db)


# ---------------------------------------------------------------------------
# Transactions
# ---------------------------------------------------------------------------

@router.get("/transactions", response_model=TransactionListResponse)
async def list_transactions(
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    category_id: Optional[uuid.UUID] = None,
    transaction_type: Optional[str] = Query(None, pattern="^(income|expense|transfer)$"),
    search: Optional[str] = Query(None, max_length=100),
    tag: Optional[str] = Query(None, max_length=50),
    account_id: Optional[uuid.UUID] = None,
    holder: Optional[str] = Query(None, max_length=80),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Filtered listing; recurring templates expand as virtual occurrences in the window."""
    return await service.list_transactions(
        current_user.id, db,
        date_from=date_from, date_to=date_to,
        category_id=category_id, transaction_type=transaction_type,
        search=search, tag=tag, account_id=account_id, holder=holder,
        page=page, per_page=per_page,
    )


@router.get("/transactions/export")
async def export_transactions(
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    category_id: Optional[uuid.UUID] = None,
    transaction_type: Optional[str] = Query(None, pattern="^(income|expense|transfer)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """CSV export (';' separator, ',' decimal — opens correctly in Excel PT-BR)."""
    listing = await service.list_transactions(
        current_user.id, db,
        date_from=date_from, date_to=date_to,
        category_id=category_id, transaction_type=transaction_type,
        per_page=100_000,
    )
    rows = [
        [
            item["transaction_date"].strftime("%d/%m/%Y"),
            item["transaction_type"],
            item["description"] or "",
            item["category_name"] or "",
            item["amount"],
        ]
        for item in listing["items"]
    ]
    return build_csv_response(
        "transacoes.csv", ["Data", "Tipo", "Descrição", "Categoria", "Valor"], rows
    )


@router.post("/transactions", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    body: TransactionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.create_transaction(current_user.id, body.model_dump(), db)


@router.patch("/transactions/{txn_id}", response_model=TransactionResponse)
async def update_transaction(
    txn_id: uuid.UUID,
    body: TransactionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.update_transaction(
        txn_id, current_user.id, body.model_dump(exclude_unset=True), db
    )


@router.delete("/transactions/{txn_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    txn_id: uuid.UUID,
    scope: str = Query("one", pattern="^(one|future|all)$",
                       description="Parcelamentos: só esta, esta e as futuras, ou a série inteira"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await service.delete_transaction(txn_id, current_user.id, db, scope=scope)


# ---------------------------------------------------------------------------
# Accounts
# ---------------------------------------------------------------------------

@router.get("/accounts", response_model=list[AccountResponse])
async def list_accounts(
    include_inactive: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Contas do usuário com saldo derivado das transações até agora."""
    return await service.list_accounts(current_user.id, db, include_inactive=include_inactive)


@router.post("/accounts", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
async def create_account(
    body: AccountCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.create_account(current_user.id, body.model_dump(), db)


@router.patch("/accounts/{account_id}", response_model=AccountResponse)
async def update_account(
    account_id: uuid.UUID,
    body: AccountUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.update_account(
        account_id, current_user.id, body.model_dump(exclude_unset=True), db
    )


@router.delete("/accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def archive_account(
    account_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Arquiva (is_active=False) — as transações históricas continuam apontando para ela."""
    await service.archive_account(account_id, current_user.id, db)


# ---------------------------------------------------------------------------
# Statement import (OFX/CSV)
# ---------------------------------------------------------------------------

@router.post("/import", response_model=ImportBatchResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("20/hour")
async def upload_statement(
    request: Request,
    file: UploadFile = File(...),
    bank_account_id: Optional[uuid.UUID] = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload de extrato OFX/CSV → dedupe contra o histórico → lote em 'pending'
    aguardando revisão. Não grava nenhuma transação ainda."""
    content = await file.read()
    return await import_service.create_import_batch_from_content(
        current_user.id, db,
        file_name=file.filename or "extrato",
        content=content,
        bank_account_id=bank_account_id,
    )


@router.get("/import/{batch_id}", response_model=ImportBatchResponse)
async def get_import_batch(
    batch_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await import_service.get_import_batch(batch_id, current_user.id, db)


@router.patch("/import/rows/{row_id}", response_model=ImportRowResponse)
async def update_import_row(
    row_id: uuid.UUID,
    body: ImportRowUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Ajustar categoria ou incluir/excluir uma linha antes de confirmar."""
    return await import_service.update_import_row(
        row_id, current_user.id, body.model_dump(exclude_unset=True), db
    )


@router.post("/import/{batch_id}/confirm", response_model=ImportConfirmResponse)
async def confirm_import_batch(
    batch_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Grava uma transação por linha selecionada. Idempotente na prática: um
    lote confirmado não pode ser confirmado de novo (409)."""
    return await import_service.confirm_import_batch(batch_id, current_user.id, db)


@router.delete("/import/{batch_id}", status_code=status.HTTP_204_NO_CONTENT)
async def discard_import_batch(
    batch_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await import_service.discard_import_batch(batch_id, current_user.id, db)


# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

@router.get("/summary", response_model=FinanceSummaryResponse)
async def get_summary(
    month: str = Query(..., description="YYYY-MM"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not _MONTH_RE.match(month):
        raise HTTPException(status_code=422, detail="month deve estar no formato YYYY-MM")
    return await service.get_summary(current_user.id, month, db)


# ---------------------------------------------------------------------------
# Budgets
# ---------------------------------------------------------------------------

@router.get("/budgets", response_model=list[BudgetResponse])
async def list_budgets(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Budgets with current-month spend and pct_used, for progress bars."""
    return await service.list_budgets(current_user.id, db)


@router.put("/budgets", response_model=BudgetResponse)
async def upsert_budget(
    body: BudgetUpsert,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create or update the budget for a category (one per category per user)."""
    return await service.upsert_budget(current_user.id, body.category_id, body.amount, db)


@router.delete("/budgets/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_budget(
    category_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await service.delete_budget(current_user.id, category_id, db)


# ---------------------------------------------------------------------------
# Savings goals
# ---------------------------------------------------------------------------

@router.get("/goals", response_model=list[GoalResponse])
async def list_goals(
    include_archived: bool = Query(default=False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_goals(current_user.id, db, include_archived=include_archived)


@router.post("/goals", response_model=GoalResponse, status_code=status.HTTP_201_CREATED)
async def create_goal(
    body: GoalCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.create_goal(
        current_user.id, body.name, body.target_amount, body.target_date, body.color, body.icon, db
    )


@router.put("/goals/{goal_id}", response_model=GoalResponse)
async def update_goal(
    goal_id: uuid.UUID,
    body: GoalUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.update_goal(current_user.id, goal_id, body.model_dump(exclude_unset=True), db)


@router.delete("/goals/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goal(
    goal_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await service.delete_goal(current_user.id, goal_id, db)


@router.post("/goals/{goal_id}/contributions", response_model=GoalResponse, status_code=status.HTTP_201_CREATED)
async def contribute_to_goal(
    goal_id: uuid.UUID,
    body: GoalContributeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add (positive amount) or withdraw (negative amount) funds from a goal."""
    return await service.contribute_to_goal(current_user.id, goal_id, body.amount, body.note, db)


@router.get("/goals/{goal_id}/contributions", response_model=list[GoalContributionResponse])
async def list_goal_contributions(
    goal_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_goal_contributions(current_user.id, goal_id, db)
