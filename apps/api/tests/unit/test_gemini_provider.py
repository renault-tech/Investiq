"""GeminiProvider — conversão de mensagens e configuração enviadas ao SDK.

Sem chamada de rede: o que interessa travar é o contrato com o google-genai
(papel 'model' em vez de 'assistant', system fora do histórico), que é
justamente o que quebra em silêncio quando o SDK muda.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

import pytest

from src.ai.base import LLMProviderError
from src.ai.gemini_provider import DEFAULT_MODEL, GeminiProvider


class _FakeModels:
    def __init__(self, text: str = "resposta", chunks: list[str] | None = None):
        self._text = text
        self._chunks = chunks or []
        self.calls: list[dict] = []

    async def generate_content(self, **kwargs):
        self.calls.append(kwargs)
        return type("R", (), {"text": self._text})()

    async def generate_content_stream(self, **kwargs):
        self.calls.append(kwargs)
        chunks = self._chunks

        async def _gen():
            for chunk in chunks:
                yield type("C", (), {"text": chunk})()

        return _gen()


class _FakeClient:
    def __init__(self, models: _FakeModels):
        self.aio = type("Aio", (), {"models": models})()


def _provider(models: _FakeModels) -> GeminiProvider:
    provider = GeminiProvider(api_key="tok")
    provider._client = lambda: _FakeClient(models)
    return provider


def test_api_key_vazia_e_rejeitada_na_construcao():
    with pytest.raises(LLMProviderError):
        GeminiProvider(api_key="")


@pytest.mark.asyncio
async def test_assistant_vira_model_e_system_sai_do_historico():
    models = _FakeModels()
    provider = _provider(models)

    await provider.complete(
        messages=[
            {"role": "user", "content": "oi"},
            {"role": "assistant", "content": "olá"},
            {"role": "user", "content": "e aí"},
        ],
        system="Você é um analista.",
    )

    call = models.calls[0]
    assert [c["role"] for c in call["contents"]] == ["user", "model", "user"]
    assert call["contents"][0]["parts"][0]["text"] == "oi"
    assert call["config"]["system_instruction"] == "Você é um analista."


@pytest.mark.asyncio
async def test_sem_system_a_chave_nao_e_enviada():
    """Mandar system_instruction=None faz o SDK reclamar em vez de ignorar."""
    models = _FakeModels()
    await _provider(models).complete(messages=[{"role": "user", "content": "oi"}])
    assert "system_instruction" not in models.calls[0]["config"]


@pytest.mark.asyncio
async def test_usa_o_modelo_padrao_quando_nenhum_e_pedido():
    models = _FakeModels()
    await _provider(models).complete(messages=[{"role": "user", "content": "oi"}])
    assert models.calls[0]["model"] == DEFAULT_MODEL


@pytest.mark.asyncio
async def test_modelo_explicito_sobrepoe_o_padrao():
    models = _FakeModels()
    await _provider(models).complete(
        messages=[{"role": "user", "content": "oi"}], model="gemini-2.5-pro"
    )
    assert models.calls[0]["model"] == "gemini-2.5-pro"


@pytest.mark.asyncio
async def test_stream_concatena_os_chunks():
    models = _FakeModels(chunks=["Ana", "lise ", "pronta"])
    provider = _provider(models)
    out = [chunk async for chunk in provider.stream(messages=[{"role": "user", "content": "oi"}])]
    assert "".join(out) == "Analise pronta"


@pytest.mark.asyncio
async def test_falha_do_sdk_vira_LLMProviderError():
    class _Explode(_FakeModels):
        async def generate_content(self, **kwargs):
            raise RuntimeError("quota exceeded")

    with pytest.raises(LLMProviderError) as exc:
        await _provider(_Explode()).complete(messages=[{"role": "user", "content": "oi"}])
    assert "gemini" in str(exc.value)


@pytest.mark.asyncio
async def test_resposta_sem_texto_vira_string_vazia():
    """response.text é None quando o modelo corta por filtro de segurança —
    devolver None faria o chamador estourar em vez de mostrar vazio."""
    class _Empty(_FakeModels):
        async def generate_content(self, **kwargs):
            return type("R", (), {"text": None})()

    assert await _provider(_Empty()).complete(messages=[{"role": "user", "content": "oi"}]) == ""
