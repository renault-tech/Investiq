"""Abstract base class for LLM providers with SSE streaming support."""
from abc import ABC, abstractmethod
from typing import AsyncIterator


class LLMProvider(ABC):
    """Abstract LLM provider. Supports both streaming and non-streaming responses."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Provider identifier: 'claude' | 'openai' | 'gemini'"""

    @abstractmethod
    async def stream(
        self,
        messages: list[dict],
        system: str | None = None,
        model: str | None = None,
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> AsyncIterator[str]:
        """Stream response tokens as an async generator.

        Each yielded string is a text delta (chunk).
        Raises LLMProviderError on unrecoverable errors.

        Args:
            messages: List of {"role": "user"|"assistant", "content": str}
            system: Optional system prompt.
            model: Override the provider's default model.
            max_tokens: Maximum output tokens.
            temperature: Sampling temperature (0.0–1.0).
        """

    @abstractmethod
    async def complete(
        self,
        messages: list[dict],
        system: str | None = None,
        model: str | None = None,
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> str:
        """Non-streaming completion. Returns full response text."""


class LLMProviderError(Exception):
    """Raised when an LLM provider call fails."""
    def __init__(self, provider: str, message: str):
        self.provider = provider
        super().__init__(f"[{provider}] {message}")
