import uuid
from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from src.analysis.models import PortfolioAnalysis, AnalysisMessage
from src.shared.exceptions import NotFoundError

async def save_analysis(portfolio_id: uuid.UUID, user_id: uuid.UUID, raw_text: str, sections: Dict[str, str], provider: str, model: str, db: AsyncSession) -> Dict[str, Any]:
    analysis = PortfolioAnalysis(
        portfolio_id=portfolio_id,
        user_id=user_id,
        raw_text=raw_text,
        sections=sections,
        provider=provider,
        model=model
    )
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)
    
    return {
        "id": analysis.id,
        "created_at": analysis.created_at,
        "provider": analysis.provider,
        "model": analysis.model,
        "summary_snippet": sections.get("summary", "")[:120]
    }

async def list_analyses(portfolio_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> List[Dict[str, Any]]:
    query = select(PortfolioAnalysis).where(
        PortfolioAnalysis.portfolio_id == portfolio_id,
        PortfolioAnalysis.user_id == user_id
    ).order_by(PortfolioAnalysis.created_at.desc())
    
    result = await db.execute(query)
    analyses = result.scalars().all()
    
    return [
        {
            "id": a.id,
            "created_at": a.created_at,
            "provider": a.provider,
            "model": a.model,
            "summary_snippet": a.sections.get("summary", "")[:120]
        }
        for a in analyses
    ]

async def get_analysis(analysis_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> PortfolioAnalysis:
    query = select(PortfolioAnalysis).options(selectinload(PortfolioAnalysis.messages)).where(
        PortfolioAnalysis.id == analysis_id,
        PortfolioAnalysis.user_id == user_id
    )
    result = await db.execute(query)
    analysis = result.scalar_one_or_none()
    
    if not analysis:
        raise NotFoundError(f"Analysis {analysis_id} not found")
        
    return analysis

async def add_message(analysis_id: uuid.UUID, user_id: uuid.UUID, role: str, content: str, db: AsyncSession) -> AnalysisMessage:
    # Verifica owner via get_analysis
    await get_analysis(analysis_id, user_id, db)
    
    message = AnalysisMessage(
        analysis_id=analysis_id,
        role=role,
        content=content
    )
    db.add(message)
    await db.commit()
    await db.refresh(message)
    return message

async def get_recent_raw_texts(portfolio_id: uuid.UUID, user_id: uuid.UUID, limit: int = 3, db: AsyncSession = None) -> List[str]:
    query = select(PortfolioAnalysis.raw_text).where(
        PortfolioAnalysis.portfolio_id == portfolio_id,
        PortfolioAnalysis.user_id == user_id
    ).order_by(PortfolioAnalysis.created_at.desc()).limit(limit)
    
    result = await db.execute(query)
    return list(result.scalars().all())
