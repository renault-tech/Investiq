"""Cards API router — card CRUD, invoice upload/review/confirm."""
import uuid
from datetime import date

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.auth.dependencies import get_current_user
from src.auth.models import User
from src.ai.factory import get_llm_provider
from src.ai.base import LLMProviderError
from src.settings import service as settings_service
from src.settings.service import get_decrypted_api_keys
from src.shared.limiter import limiter
from src.shared.exceptions import ValidationError
from src.cards import service
from src.cards.schemas import (
    CardCreate,
    CardUpdate,
    CardResponse,
    InvoiceResponse,
    InvoiceDetailResponse,
    InvoiceItemResponse,
    InvoiceItemUpdate,
)

router = APIRouter(prefix="/cards", tags=["cards"])


# ---------------------------------------------------------------------------
# Cards CRUD
# ---------------------------------------------------------------------------

@router.get("", response_model=list[CardResponse])
async def list_cards(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_cards(current_user.id, db)


@router.post("", response_model=CardResponse, status_code=status.HTTP_201_CREATED)
async def create_card(
    body: CardCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.create_card(current_user.id, body.model_dump(), db)


@router.patch("/{card_id}", response_model=CardResponse)
async def update_card(
    card_id: uuid.UUID,
    body: CardUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.update_card(card_id, current_user.id, body.model_dump(exclude_unset=True), db)


@router.delete("/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_card(
    card_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await service.delete_card(card_id, current_user.id, db)


# ---------------------------------------------------------------------------
# Invoices
# ---------------------------------------------------------------------------

@router.post("/{card_id}/invoices", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/hour")
async def upload_invoice(
    request: Request,
    card_id: uuid.UUID,
    reference_month: date = Form(..., description="Qualquer dia do mês de referência"),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload PDF/CSV → text extraction → AI item extraction → status 'review'.

    Rate limited (10/hour): each upload spends the user's own LLM credits.
    """
    user_settings = await settings_service.get_or_create(current_user.id, db)
    await db.commit()
    keys = get_decrypted_api_keys(user_settings)
    try:
        provider = get_llm_provider(
            preferred=user_settings.preferred_llm,
            claude_api_key=keys.get("claude_api_key"),
            openai_api_key=keys.get("openai_api_key"),
            gemini_api_key=keys.get("gemini_api_key"),
        )
    except LLMProviderError as exc:
        raise ValidationError(
            "Configure uma chave de IA em Configurações antes de importar faturas"
        ) from exc

    content = await file.read()
    return await service.process_invoice_upload(
        card_id=card_id,
        user_id=current_user.id,
        reference_month=reference_month,
        file_name=file.filename or "fatura",
        content=content,
        provider=provider,
        llm_model=user_settings.llm_model,
        db=db,
    )


@router.get("/{card_id}/invoices", response_model=list[InvoiceResponse])
async def list_invoices(
    card_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_invoices(card_id, current_user.id, db)


@router.get("/invoices/{invoice_id}", response_model=InvoiceDetailResponse)
async def get_invoice(
    invoice_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_invoice(invoice_id, current_user.id, db)


@router.patch("/invoices/{invoice_id}/items/{item_id}", response_model=InvoiceItemResponse)
async def update_invoice_item(
    invoice_id: uuid.UUID,
    item_id: uuid.UUID,
    body: InvoiceItemUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.update_invoice_item(
        invoice_id, item_id, current_user.id, body.model_dump(exclude_unset=True), db
    )


@router.post("/invoices/{invoice_id}/confirm", response_model=InvoiceResponse)
async def confirm_invoice(
    invoice_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate one expense transaction per non-ignored item. Idempotent (409 on repeat)."""
    return await service.confirm_invoice(invoice_id, current_user.id, db)


@router.delete("/invoices/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_invoice(
    invoice_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await service.delete_invoice(invoice_id, current_user.id, db)
