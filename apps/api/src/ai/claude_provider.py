"""Anthropic Claude LLM provider."""
import logging
from typing import AsyncIterator

from src.ai.base import LLMProvider, LLMProviderError

logger = logging.getLogger(__name__)

DEFAULT_MODEL = "claude-sonnet-4-6"


class ClaudeProvider(LLMProvider):
    """Anthropic Claude provider using the official SDK."""

    def __init__(self, api_key: str):
        if not api_key:
            raise LLMProviderError("claude", "API key is required")
        self._api_key = api_key

    @property
    def name(self) -> str:
        return "claude"

    async def stream(
        self,
        messages: list[dict],
        system: str | None = None,
        model: str | None = None,
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> AsyncIterator[str]:
        try:
            import anthropic
            client = anthropic.AsyncAnthropic(api_key=self._api_key)
            kwargs = {
                "model": model or DEFAULT_MODEL,
                "max_tokens": max_tokens,
                "messages": messages,
            }
            if system:
                kwargs["system"] = system

            async with client.messages.stream(**kwargs) as stream_ctx:
                async for text in stream_ctx.text_stream:
                    yield text
        except Exception as exc:
            raise LLMProviderError("claude", str(exc)) from exc

    async def complete(
        self,
        messages: list[dict],
        system: str | None = None,
        model: str | None = None,
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> str:
        try:
            import anthropic
            client = anthropic.AsyncAnthropic(api_key=self._api_key)
            kwargs = {
                "model": model or DEFAULT_MODEL,
                "max_tokens": max_tokens,
                "messages": messages,
            }
            if system:
                kwargs["system"] = system
            response = await client.messages.create(**kwargs)
            return response.content[0].text
        except Exception as exc:
            raise LLMProviderError("claude", str(exc)) from exc
