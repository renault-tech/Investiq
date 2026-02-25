"""Google Gemini LLM provider via google-generativeai SDK."""
import logging
from typing import AsyncIterator

from src.ai.base import LLMProvider, LLMProviderError

logger = logging.getLogger(__name__)

DEFAULT_MODEL = "gemini-1.5-pro"


class GeminiProvider(LLMProvider):
    """Google Gemini provider."""

    def __init__(self, api_key: str):
        if not api_key:
            raise LLMProviderError("gemini", "API key is required")
        self._api_key = api_key

    @property
    def name(self) -> str:
        return "gemini"

    def _convert_messages(self, messages: list[dict], system: str | None) -> tuple[list[dict], str | None]:
        """Convert messages to Gemini format (no 'system' role in history)."""
        history = []
        for msg in messages:
            role = "user" if msg["role"] == "user" else "model"
            history.append({"role": role, "parts": [msg["content"]]})
        return history, system

    async def stream(
        self,
        messages: list[dict],
        system: str | None = None,
        model: str | None = None,
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> AsyncIterator[str]:
        try:
            import google.generativeai as genai
            genai.configure(api_key=self._api_key)
            gen_model = genai.GenerativeModel(
                model_name=model or DEFAULT_MODEL,
                system_instruction=system,
            )
            history, _ = self._convert_messages(messages[:-1], system)
            last_message = messages[-1]["content"] if messages else ""

            chat = gen_model.start_chat(history=history)
            response = await chat.send_message_async(
                last_message,
                stream=True,
                generation_config={"max_output_tokens": max_tokens, "temperature": temperature},
            )
            async for chunk in response:
                text = chunk.text
                if text:
                    yield text
        except Exception as exc:
            raise LLMProviderError("gemini", str(exc)) from exc

    async def complete(
        self,
        messages: list[dict],
        system: str | None = None,
        model: str | None = None,
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> str:
        try:
            import google.generativeai as genai
            genai.configure(api_key=self._api_key)
            gen_model = genai.GenerativeModel(
                model_name=model or DEFAULT_MODEL,
                system_instruction=system,
            )
            history, _ = self._convert_messages(messages[:-1], system)
            last_message = messages[-1]["content"] if messages else ""

            chat = gen_model.start_chat(history=history)
            response = await chat.send_message_async(
                last_message,
                generation_config={"max_output_tokens": max_tokens, "temperature": temperature},
            )
            return response.text
        except Exception as exc:
            raise LLMProviderError("gemini", str(exc)) from exc
