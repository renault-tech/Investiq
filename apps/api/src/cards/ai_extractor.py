"""LLM-based extraction of invoice line items from raw invoice text.

Uses the user's configured multi-provider LLM (non-streaming complete()).
Output is strict JSON validated by Pydantic; one corrective retry on invalid
JSON; long texts are chunked and merged.
"""
import json
import logging
from datetime import date as dt_date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, ValidationError

from src.ai.base import LLMProvider, LLMProviderError

logger = logging.getLogger(__name__)

CHUNK_CHARS = 30_000
MAX_ITEMS = 500


class ExtractedItem(BaseModel):
    description: str = Field(..., max_length=255)
    amount: Decimal
    date: Optional[dt_date] = None
    installment_no: Optional[int] = Field(None, ge=1, le=99)
    installment_total: Optional[int] = Field(None, ge=1, le=99)
    suggested_category: Optional[str] = None


class ExtractionResult(BaseModel):
    items: list[ExtractedItem] = Field(default_factory=list)
    total: Optional[Decimal] = None
    due_date: Optional[dt_date] = None


class InvoiceExtractionError(Exception):
    """Raised when the LLM cannot produce a valid extraction."""


_SYSTEM_PROMPT = """Você extrai lançamentos de faturas de cartão de crédito brasileiras.
Responda APENAS com JSON válido, sem markdown, sem comentários, no formato:
{"items":[{"description":"...","amount":123.45,"date":"2026-06-15","installment_no":null,"installment_total":null,"suggested_category":"Alimentação"}],"total":1234.56,"due_date":"2026-07-10"}

Regras:
- amount sempre positivo, em reais, ponto como separador decimal.
- Ignore linhas de pagamento/crédito/estorno da fatura anterior (ex.: "PAGAMENTO RECEBIDO").
- Parcelas "3/10" → installment_no=3, installment_total=10.
- date no formato ISO (YYYY-MM-DD); null se não identificável.
- suggested_category deve ser EXATAMENTE um dos nomes fornecidos na lista de categorias, ou null.
- Campos desconhecidos: null. Nunca invente valores."""


def _strip_code_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        first_newline = text.find("\n")
        if first_newline != -1:
            text = text[first_newline + 1:]
        if text.rstrip().endswith("```"):
            text = text.rstrip()[:-3]
    return text.strip()


async def _extract_chunk(
    provider: LLMProvider,
    model: Optional[str],
    text: str,
    category_names: list[str],
) -> ExtractionResult:
    user_prompt = (
        f"Categorias disponíveis: {json.dumps(category_names, ensure_ascii=False)}\n\n"
        f"Texto da fatura:\n{text}"
    )
    messages = [{"role": "user", "content": user_prompt}]

    last_error: Optional[Exception] = None
    for attempt in range(2):
        try:
            raw = await provider.complete(
                messages=messages,
                system=_SYSTEM_PROMPT,
                model=model,
                max_tokens=8192,
                temperature=0.0,
            )
        except LLMProviderError as exc:
            raise InvoiceExtractionError(str(exc)) from exc

        try:
            return ExtractionResult.model_validate_json(_strip_code_fences(raw))
        except (ValidationError, ValueError) as exc:
            last_error = exc
            logger.warning("Invoice extraction JSON invalid (attempt %d): %s", attempt + 1, exc)
            messages = messages + [
                {"role": "assistant", "content": raw},
                {"role": "user", "content": "A resposta anterior não é JSON válido no formato pedido. Responda novamente APENAS com o JSON corrigido."},
            ]

    raise InvoiceExtractionError(f"IA não retornou JSON válido: {last_error}")


async def extract_invoice_items(
    provider: LLMProvider,
    model: Optional[str],
    raw_text: str,
    category_names: list[str],
) -> ExtractionResult:
    """Extract items from invoice text, chunking long inputs and merging results."""
    chunks = [raw_text[i:i + CHUNK_CHARS] for i in range(0, len(raw_text), CHUNK_CHARS)] or [raw_text]

    merged = ExtractionResult()
    for chunk in chunks:
        result = await _extract_chunk(provider, model, chunk, category_names)
        merged.items.extend(result.items)
        merged.total = merged.total or result.total
        merged.due_date = merged.due_date or result.due_date
        if len(merged.items) >= MAX_ITEMS:
            merged.items = merged.items[:MAX_ITEMS]
            break

    if not merged.items:
        raise InvoiceExtractionError("Nenhum lançamento identificado na fatura")
    return merged
