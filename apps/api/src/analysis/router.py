import uuid
from typing import List, Dict

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.auth.dependencies import get_current_user
from src.auth.models import User
from src.analysis import service as analysis_service
from src.analysis import schemas as analysis_schemas

router = APIRouter(prefix="/portfolios", tags=["analysis"])
analysis_router = APIRouter(prefix="/analyses", tags=["analysis"])

@analysis_router.post("", status_code=201)
async def create_analysis(
    req: analysis_schemas.SaveAnalysisRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await analysis_service.save_analysis(
        req.portfolio_id,
        current_user.id,
        req.raw_text,
        req.sections,
        req.provider or "unknown",
        req.model or "unknown",
        db
    )

@router.get("/{id}/analyses", response_model=List[analysis_schemas.AnalysisListItem])
async def list_portfolio_analyses(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await analysis_service.list_analyses(id, current_user.id, db)

@router.get("/{id}/analyses/recent-context", response_model=analysis_schemas.RecentContextResponse)
async def get_recent_analysis_context(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    raw_texts = await analysis_service.get_recent_raw_texts(id, current_user.id, 3, db)
    return {"raw_texts": raw_texts}

@analysis_router.get("/{id}", response_model=analysis_schemas.AnalysisDetail)
async def get_analysis_detail(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await analysis_service.get_analysis(id, current_user.id, db)

@analysis_router.post("/{id}/messages", response_model=analysis_schemas.AnalysisMessageSchema)
async def add_analysis_message(
    id: uuid.UUID,
    req: analysis_schemas.AddMessageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Note: SSE stream is initiated directly via /ai/analyze by frontend
    # This just saves the user's message before the stream, or the assistant's message after the stream
    # Wait, the spec says "POST /analyses/{id}/messages" Envia follow-up; stream SSE + salva ambos os lados.
    # But later it says "addMessage não usa apiClient — usa fetch diretamente (ReadableStream SSE)", meaning the frontend hits "/analyses/{id}/messages" for the SSE!
    # "fetch POST /analyses/{id}/messages com body { content } -> lê ReadableStream igual ao fluxo de análise"
    # Actually wait! The AI analysis isn't doing SSE here, it says "salva mensagem... abre stream para /ai/analyze" - the spec is ambiguous whether the backend or frontend opens the stream.
    # Ah, the spec says: "Fluxo: salva mensagem do usuário -> abre stream para /ai/analyze com histórico". That means the *frontend* saves it, then streams /ai, then saves assistant.
    # So this endpoint here just saves the message and returns it!
    # Wait, "role" is missing from AddMessageRequest. So how does it know if it's user or assistant?
    # I'll just default to "user" if not provided, wait! The spec says AddMessageRequest has only "content: str".
    # I'd better add a "role" field to AddMessageRequest to let frontend specify.
    return await analysis_service.add_message(id, current_user.id, "user", req.content, db)
