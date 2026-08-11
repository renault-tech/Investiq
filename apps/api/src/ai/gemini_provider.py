"""Google Gemini LLM provider via the google-genai SDK.

O SDK entra por import preguiçoso, como o resto dos provedores: quem usa
Claude ou OpenAI não paga o custo de carregá-lo, e a ausência dele vira um
erro claro na hora da chamada em vez de derrubar a importação do módulo.
"""
import logging
from typing import AsyncIterator

from src.ai.base import LLMProvider, LLMProviderError

logger = logging.getLogger(__name__)

DEFAULT_MODEL = "gemini-2.5-flash"

_MISSING_SDK = (
    "google-genai não está instalado neste ambiente. "
    "Adicione `google-genai` às dependências da API."
)


class GeminiProvider(LLMProvider):
    """Google Gemini provider."""

    def __init__(self, api_key: str):
        if not api_key:
            raise LLMProviderError("gemini", "API key is required")
        self._api_key = api_key

    @property
    def name(self) -> str:
        return "gemini"

    @property
    def default_model(self) -> str:
        return DEFAULT_MODEL

    def _client(self):
        try:
            from google import genai
        except ImportError as exc:
            raise LLMProviderError("gemini", _MISSING_SDK) from exc
        return genai.Client(api_key=self._api_key)

    @staticmethod
    def _to_contents(messages: list[dict]) -> list[dict]:
        """Gemini não tem papel 'system' no histórico (vai em config) e chama
        o assistente de 'model'."""
        return [
            {
                "role": "model" if msg["role"] == "assistant" else "user",
                "parts": [{"text": msg["content"]}],
            }
            for msg in messages
        ]

    def _config(self, system: str | None, max_tokens: int, temperature: float) -> dict:
        config = {"max_output_tokens": max_tokens, "temperature": temperature}
        if system:
            config["system_instruction"] = system
        return config

    async def stream(
        self,
        messages: list[dict],
        system: str | None = None,
        model: str | None = None,
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> AsyncIterator[str]:
        try:
            client = self._client()
            response = await client.aio.models.generate_content_stream(
                model=model or DEFAULT_MODEL,
                contents=self._to_contents(messages),
                config=self._config(system, max_tokens, temperature),
            )
            async for chunk in response:
                text = getattr(chunk, "text", None)
                if text:
                    yield text
        except LLMProviderError:
            raise
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
            client = self._client()
            response = await client.aio.models.generate_content(
                model=model or DEFAULT_MODEL,
                contents=self._to_contents(messages),
                config=self._config(system, max_tokens, temperature),
            )
            return response.text or ""
        except LLMProviderError:
            raise
        except Exception as exc:
            raise LLMProviderError("gemini", str(exc)) from exc
