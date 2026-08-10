"""Categorização automática determinística: normaliza a descrição do banco
numa chave de estabelecimento e casa contra as regras aprendidas do usuário.

Gratuito e instantâneo por padrão — a IA (`ai_categorizer.py`) só entra sob
demanda, para chaves que isto aqui não reconhece.
"""
import re
import unicodedata
import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import func

from src.finance.rule_models import FinanceCategoryRule

# Prefixos de operação bancária brasileira, dos mais específicos para os mais
# genéricos — a ordem importa porque a alternação do regex tenta cada opção
# na ordem em que aparece.
_PREFIXES = [
    r"PIX\s+ENVIADO", r"PIX\s+RECEBIDO", r"PIX\s+QR\s+CODE",
    r"COMPRA\s+CARTAO\s+CREDITO", r"COMPRA\s+CARTAO", r"COMPRA\s+CART\b", r"COMPRA\b",
    r"DEBITO\s+AUTOMATICO", r"DEBITO\b", r"CREDITO\b",
    r"TARIFA\s+PACOTE\s+DE\s+SERVICOS", r"TARIFA\b",
    r"TRANSFERENCIA\s+ENVIADA", r"TRANSFERENCIA\s+RECEBIDA", r"TRANSFERENCIA\b",
    r"PAGAMENTO\s+DE\s+BOLETO", r"PAGAMENTO\b",
    r"TED\b", r"DOC\b", r"SAQUE\b",
]
_PREFIX_RE = re.compile(r"^(?:" + "|".join(_PREFIXES) + r")\s*", re.IGNORECASE)
_DATE_RE = re.compile(r"\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b")
_LONG_DIGITS_RE = re.compile(r"\b\d{3,}\b")
_ACQUIRER_SUFFIX_RE = re.compile(r"\*\S+")


def merchant_key(description: str) -> str:
    """"COMPRA CARTAO 1234 IFOOD *IFD" -> "IFOOD"
    "PIX ENVIADO 12/03 JOAO S" -> "JOAO S"
    "TARIFA PACOTE SERVICOS" -> "PACOTE SERVICOS" """
    decomposed = unicodedata.normalize("NFKD", description or "")
    text = "".join(c for c in decomposed if not unicodedata.combining(c)).upper()
    text = _PREFIX_RE.sub("", text)
    text = _DATE_RE.sub("", text)
    text = _ACQUIRER_SUFFIX_RE.sub("", text)
    text = _LONG_DIGITS_RE.sub("", text)
    return re.sub(r"\s+", " ", text).strip()[:100]


async def suggest_category(user_id: uuid.UUID, description: str, db: AsyncSession) -> Optional[uuid.UUID]:
    """Regra determinística para esta chave, se existir. O índice único
    (user_id, pattern) garante no máximo uma regra por chave — não há cadeia
    de prioridades a resolver, só existe uma resposta possível."""
    key = merchant_key(description)
    if not key:
        return None
    result = await db.execute(
        select(FinanceCategoryRule.category_id).where(
            FinanceCategoryRule.user_id == user_id,
            FinanceCategoryRule.pattern == key,
        )
    )
    return result.scalar_one_or_none()


async def _upsert_rule(
    user_id: uuid.UUID, key: str, category_id: uuid.UUID, source: str, db: AsyncSession,
    *, overwrite: bool,
) -> None:
    stmt = pg_insert(FinanceCategoryRule).values(
        user_id=user_id, pattern=key, match_type="exact",
        category_id=category_id, source=source, hit_count=1, last_used_at=func.now(),
    )
    if overwrite:
        stmt = stmt.on_conflict_do_update(
            constraint="uq_finance_category_rules_user_pattern",
            set_={
                "category_id": category_id,
                "source": source,
                "hit_count": FinanceCategoryRule.hit_count + 1,
                "last_used_at": func.now(),
            },
        )
    else:
        stmt = stmt.on_conflict_do_nothing(constraint="uq_finance_category_rules_user_pattern")
    await db.execute(stmt)


async def learn_from_correction(
    user_id: uuid.UUID, description: str, category_id: uuid.UUID, db: AsyncSession
) -> None:
    """Chame sempre que o usuário atribuir uma categoria de próprio punho —
    criar/editar uma transação manual, ou ajustar uma linha de importação.
    Uma correção sempre vira 'learned', mesmo sobre uma regra que era 'ai':
    é o sinal mais forte que existe. Não commita — parte da mesma transação
    de banco de quem chamou."""
    key = merchant_key(description)
    if len(key) < 2:   # chave curta demais não é um estabelecimento confiável
        return
    await _upsert_rule(user_id, key, category_id, "learned", db, overwrite=True)


async def save_ai_suggestion(
    user_id: uuid.UUID, description: str, category_id: uuid.UUID, db: AsyncSession
) -> None:
    """Grava uma sugestão de IA aceita, para não pagar pela mesma chave de
    novo. Nunca sobrescreve uma regra já existente — só a IA pode ter perdido
    a corrida contra uma correção do usuário, nunca o contrário."""
    key = merchant_key(description)
    if len(key) < 2:
        return
    await _upsert_rule(user_id, key, category_id, "ai", db, overwrite=False)
