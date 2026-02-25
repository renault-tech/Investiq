"""LLM provider factory and SSE streaming helper."""
import json
import logging
from typing import AsyncIterator, Optional

from fastapi.responses import StreamingResponse

from src.ai.base import LLMProvider, LLMProviderError
from src.ai.claude_provider import ClaudeProvider
from src.ai.openai_provider import OpenAIProvider
from src.ai.gemini_provider import GeminiProvider

logger = logging.getLogger(__name__)


def get_llm_provider(
    preferred: str = "claude",
    claude_api_key: Optional[str] = None,
    openai_api_key: Optional[str] = None,
    gemini_api_key: Optional[str] = None,
) -> LLMProvider:
    """Return the appropriate LLM provider based on user preference.

    API keys are expected to be already decrypted (Fernet) before passing here.

    Args:
        preferred: 'claude' | 'openai' | 'gemini'
        claude_api_key: Decrypted Anthropic API key.
        openai_api_key: Decrypted OpenAI API key.
        gemini_api_key: Decrypted Google Gemini API key.

    Returns:
        Configured LLMProvider instance.

    Raises:
        LLMProviderError: If the preferred provider has no API key configured.
    """
    if preferred == "openai":
        if not openai_api_key:
            raise LLMProviderError("openai", "No OpenAI API key configured")
        return OpenAIProvider(openai_api_key)

    if preferred == "gemini":
        if not gemini_api_key:
            raise LLMProviderError("gemini", "No Gemini API key configured")
        return GeminiProvider(gemini_api_key)

    # Default: Claude
    if not claude_api_key:
        raise LLMProviderError("claude", "No Claude API key configured")
    return ClaudeProvider(claude_api_key)


async def sse_stream(
    provider: LLMProvider,
    messages: list[dict],
    system: str | None = None,
    model: str | None = None,
    max_tokens: int = 4096,
    temperature: float = 0.7,
) -> AsyncIterator[str]:
    """Yield SSE-formatted events from an LLM provider stream.

    Each yielded string is a complete SSE event line:
      data: {"type": "delta", "text": "...chunk..."}\n\n

    A final event is emitted:
      data: {"type": "done"}\n\n

    On error:
      data: {"type": "error", "message": "..."}\n\n
    """
    try:
        async for chunk in provider.stream(
            messages=messages,
            system=system,
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
        ):
            payload = json.dumps({"type": "delta", "text": chunk})
            yield f"data: {payload}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"
    except LLMProviderError as exc:
        payload = json.dumps({"type": "error", "message": str(exc)})
        yield f"data: {payload}\n\n"
    except Exception as exc:
        logger.error("Unexpected LLM stream error: %s", exc)
        payload = json.dumps({"type": "error", "message": "Internal server error"})
        yield f"data: {payload}\n\n"


def make_sse_response(
    provider: LLMProvider,
    messages: list[dict],
    system: str | None = None,
    model: str | None = None,
    max_tokens: int = 4096,
    temperature: float = 0.7,
) -> StreamingResponse:
    """Create a FastAPI StreamingResponse for SSE delivery."""
    return StreamingResponse(
        sse_stream(provider, messages, system, model, max_tokens, temperature),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # disable nginx buffering
        },
    )
