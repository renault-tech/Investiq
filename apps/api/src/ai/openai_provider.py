"""OpenAI LLM provider."""
import logging
from typing import AsyncIterator

from src.ai.base import LLMProvider, LLMProviderError

logger = logging.getLogger(__name__)

DEFAULT_MODEL = "gpt-4o"


class OpenAIProvider(LLMProvider):
    """OpenAI provider using the official SDK."""

    def __init__(self, api_key: str):
        if not api_key:
            raise LLMProviderError("openai", "API key is required")
        self._api_key = api_key

    @property
    def name(self) -> str:
        return "openai"

    def _build_messages(self, messages: list[dict], system: str | None) -> list[dict]:
        """Prepend system message in OpenAI format if provided."""
        if system:
            return [{"role": "system", "content": system}, *messages]
        return messages

    async def stream(
        self,
        messages: list[dict],
        system: str | None = None,
        model: str | None = None,
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> AsyncIterator[str]:
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=self._api_key)
            async with client.chat.completions.stream(
                model=model or DEFAULT_MODEL,
                messages=self._build_messages(messages, system),
                max_tokens=max_tokens,
                temperature=temperature,
            ) as stream_ctx:
                async for event in stream_ctx:
                    delta = event.choices[0].delta.content if event.choices else None
                    if delta:
                        yield delta
        except Exception as exc:
            raise LLMProviderError("openai", str(exc)) from exc

    async def complete(
        self,
        messages: list[dict],
        system: str | None = None,
        model: str | None = None,
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> str:
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=self._api_key)
            response = await client.chat.completions.create(
                model=model or DEFAULT_MODEL,
                messages=self._build_messages(messages, system),
                max_tokens=max_tokens,
                temperature=temperature,
            )
            return response.choices[0].message.content or ""
        except Exception as exc:
            raise LLMProviderError("openai", str(exc)) from exc
