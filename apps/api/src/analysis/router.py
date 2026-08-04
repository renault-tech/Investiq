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
    """Persist a chat message attached to an analysis.

    This endpoint only stores messages — streaming stays on POST /ai/analyze.
    The frontend flow is: save the user message here, stream the reply from
    /ai/analyze, then save the assistant message here with role="assistant".
    """
    return await analysis_service.add_message(id, current_user.id, req.role, req.content, db)
