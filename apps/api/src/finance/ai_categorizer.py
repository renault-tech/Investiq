"""Categorização por IA — só sob demanda, nunca embutida na importação: gasta
o crédito de API do próprio usuário. Mesmo padrão de src/cards/ai_extractor.py
(JSON estrito, uma retentativa corretiva, temperature=0), adaptado para
sugerir categoria em vez de extrair lançamentos.
"""
import json
import logging
from typing import Optional

from pydantic import BaseModel, Field, ValidationError

from src.ai.base import LLMProvider, LLMProviderError

logger = logging.getLogger(__name__)

MAX_ITEMS = 200

_SYSTEM_PROMPT = """Você categoriza transações de um extrato bancário brasileiro.
Para cada item da lista (identificado por "key"), escolha a categoria mais adequada
dentre as fornecidas para o tipo da transação (receita ou despesa), ou null se
nenhuma se encaixar bem.
Responda APENAS com JSON válido, sem markdown, no formato:
{"suggestions":[{"key":"...","category":"..."}]}

Regras:
- category deve ser EXATAMENTE um dos nomes fornecidos na lista do tipo correspondente, ou null.
- Nunca invente categorias. Campos incertos: null."""


class _Suggestion(BaseModel):
    key: str
    category: Optional[str] = None


class _SuggestionResult(BaseModel):
    suggestions: list[_Suggestion] = Field(default_factory=list)


class CategorizationError(Exception):
    """A IA não retornou uma sugestão utilizável."""


def _strip_code_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        first_newline = text.find("\n")
        if first_newline != -1:
            text = text[first_newline + 1:]
        if text.rstrip().endswith("```"):
            text = text.rstrip()[:-3]
    return text.strip()


async def suggest_categories_with_ai(
    provider: LLMProvider,
    model: Optional[str],
    items: list[dict],  # [{"key": merchant_key, "description": raw, "type": "income"|"expense"}]
    income_categories: list[str],
    expense_categories: list[str],
) -> dict[str, Optional[str]]:
    """Devolve {merchant_key: nome_da_categoria_ou_None}. Uma chamada só,
    independente de quantas linhas do lote compartilham a mesma chave."""
    if not items:
        return {}
    items = items[:MAX_ITEMS]

    payload = json.dumps(
        [{"key": it["key"], "descricao": it["description"], "tipo": it["type"]} for it in items],
        ensure_ascii=False,
    )
    user_prompt = (
        f"Categorias de despesa disponíveis: {json.dumps(expense_categories, ensure_ascii=False)}\n"
        f"Categorias de receita disponíveis: {json.dumps(income_categories, ensure_ascii=False)}\n\n"
        f"Itens a categorizar:\n{payload}"
    )
    messages = [{"role": "user", "content": user_prompt}]

    valid_names = set(income_categories) | set(expense_categories)
    last_error: Optional[Exception] = None
    for attempt in range(2):
        try:
            raw = await provider.complete(
                messages=messages, system=_SYSTEM_PROMPT, model=model,
                max_tokens=4096, temperature=0.0,
            )
        except LLMProviderError as exc:
            raise CategorizationError(str(exc)) from exc

        try:
            result = _SuggestionResult.model_validate_json(_strip_code_fences(raw))
            return {
                s.key: s.category if s.category in valid_names else None
                for s in result.suggestions
            }
        except (ValidationError, ValueError) as exc:
            last_error = exc
            logger.warning("AI categorization JSON invalid (attempt %d): %s", attempt + 1, exc)
            messages = messages + [
                {"role": "assistant", "content": raw},
                {"role": "user", "content": "A resposta anterior não é JSON válido no formato pedido. Responda novamente APENAS com o JSON corrigido."},
            ]

    raise CategorizationError(f"IA não retornou JSON válido: {last_error}")
