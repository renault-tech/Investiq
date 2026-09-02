"""Filtro de titular compartilhado entre transações, analytics e forecast.

`holder` chega como string simples de query param, e o valor natural para
"sem titular" seria None — mas None já significa "sem filtro nenhum" (todos
os titulares). Precisava de um terceiro valor, distinto dos dois, para a
pessoa poder escolher explicitamente "só as minhas contas" quando já existe
alguma conta de outro titular — daí o sentinela.
"""
from sqlalchemy import ColumnElement

from src.finance.account_models import BankAccount

# Nunca colide com um nome de titular real (nome de titular vem de texto
# livre digitado por humano) — o "__" duplo e o formato de identificador não
# são como alguém nomeia uma pessoa.
NO_HOLDER = "__sem_titular__"


def holder_condition(holder: str) -> ColumnElement:
    """Condição SQL para o valor de `holder` recebido — trata o sentinelo
    como "titular não definido" (`IS NULL`), e qualquer outro valor como
    igualdade normal."""
    if holder == NO_HOLDER:
        return BankAccount.holder.is_(None)
    return BankAccount.holder == holder
