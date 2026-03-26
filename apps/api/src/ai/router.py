"""AI analysis endpoint — SSE streaming backed by user-configured LLM provider."""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.auth.dependencies import get_current_user
from src.auth.models import User
from src.ai.factory import get_llm_provider, make_sse_response
from src.ai.base import LLMProviderError
from src.settings import service as settings_service
from src.settings.service import get_decrypted_api_keys
from src.shared.limiter import limiter
from src.shared.exceptions import ValidationError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["ai"])


import uuid

class AnalyzeRequest(BaseModel):
    messages: list[dict]
    system: Optional[str] = None
    model: Optional[str] = None
    max_tokens: int = 4096
    temperature: float = 0.7
    portfolio_id: Optional[uuid.UUID] = None
    previous_analyses: Optional[list[str]] = None


@router.post("/analyze")
@limiter.limit("20/hour")
async def analyze(
    request: Request,
    body: AnalyzeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Stream an AI analysis response via Server-Sent Events.

    Rate limited to 20 requests/hour per IP to control LLM costs.
    Uses the LLM provider configured in the user's settings.
    """
    # Ensures a UserSettings row exists with defaults (req 4)
    user_settings = await settings_service.get_or_create(current_user.id, db)
    await db.commit()

    preferred = user_settings.preferred_llm
    keys = get_decrypted_api_keys(user_settings)
    model_override = body.model or user_settings.llm_model

    try:
        provider = get_llm_provider(
            preferred=preferred,
            claude_api_key=keys.get("claude_api_key"),
            openai_api_key=keys.get("openai_api_key"),
            gemini_api_key=keys.get("gemini_api_key"),
        )
    except LLMProviderError as exc:
        raise ValidationError(str(exc)) from exc

    system_prompt = body.system

    if body.previous_analyses:
        analyses_text = "\\n---\\n".join(body.previous_analyses)
        system_prompt = f"""Você é um analista financeiro institucional. Ao gerar a análise, mantenha
consistência com as análises anteriores do mesmo portfólio fornecidas abaixo.
Estruture a resposta com os seguintes headers markdown exatos:
## Contexto da Análise
## Resumo Executivo
## Composição
## Riscos
## Oportunidades
## Recomendações

Análises anteriores (do mais recente ao mais antigo):
---
{analyses_text}
"""


    return make_sse_response(
        provider=provider,
        messages=body.messages,
        system=system_prompt,
        model=model_override,
        max_tokens=body.max_tokens,
        temperature=body.temperature,
    )
