"""Tradução de erros de validação do Pydantic para português.

FastAPI devolve `RequestValidationError` com o texto cru dos validadores do
Pydantic/email-validator ("value is not a valid email address: The part
after the @-sign is..."), em inglês, direto na resposta — o front só
repassava isso pro usuário. O `type` de cada erro é estruturado e estável
entre versões (ver https://errors.pydantic.dev/2.13/v/<type>), então a
tradução funciona por esse campo, não por casar string em inglês — a
exceção é EmailStr, cujo validador devolve sempre `type="value_error"`
igual a qualquer outro `@field_validator` customizado, então esse caso
precisa olhar o prefixo do `msg` original para se distinguir dos demais.
"""
from typing import Any

# Nomes de campo comuns nos schemas do app, para a mensagem citar o campo em
# português em vez de "email" ou "new_password" cru.
_FIELD_LABELS_PT = {
    "email": "E-mail",
    "password": "Senha",
    "new_password": "Nova senha",
    "current_password": "Senha atual",
    "full_name": "Nome completo",
    "name": "Nome",
    "amount": "Valor",
    "quantity": "Quantidade",
    "unit_price": "Preço unitário",
    "ticker": "Ticker",
    "token": "Token",
}


def _field_label(loc: tuple) -> str:
    field = loc[-1] if loc else None
    if field is None or isinstance(field, int):
        # loc aponta pra um índice de lista (ex.: item de um array no body)
        # em vez de nome de campo — melhor genérico do que "loc[-2]" errado.
        return "Campo"
    return _FIELD_LABELS_PT.get(str(field), str(field).replace("_", " ").capitalize())


def translate_pydantic_error(error: dict[str, Any]) -> str:
    """Uma linha de erro do Pydantic (`ValidationError.errors()[i]`) -> frase em pt-BR."""
    label = _field_label(tuple(error.get("loc") or ()))
    error_type = error.get("type", "")
    msg = error.get("msg", "")
    ctx = error.get("ctx") or {}

    if error_type == "missing":
        return f"{label} é obrigatório."
    if error_type == "value_error" and "valid email address" in msg:
        return f"{label} inválido — informe um e-mail real."
    if error_type in ("string_too_short", "list_too_short"):
        min_len = ctx.get("min_length")
        return f"{label} muito curto (mínimo {min_len} caracteres)." if min_len else f"{label} muito curto."
    if error_type in ("string_too_long", "list_too_long"):
        max_len = ctx.get("max_length")
        return f"{label} muito longo (máximo {max_len} caracteres)." if max_len else f"{label} muito longo."
    if error_type in ("int_parsing", "int_type", "float_parsing", "float_type"):
        return f"{label} deve ser um número."
    if error_type == "string_type":
        return f"{label} deve ser texto."
    if error_type in ("bool_parsing", "bool_type"):
        return f"{label} inválido."
    if error_type in ("date_parsing", "date_type", "datetime_parsing", "datetime_type"):
        return f"{label} tem um formato de data inválido."
    if error_type in ("greater_than", "greater_than_equal"):
        limit = ctx.get("gt", ctx.get("ge"))
        return f"{label} deve ser maior que {limit}." if limit is not None else f"{label} inválido."
    if error_type in ("less_than", "less_than_equal"):
        limit = ctx.get("lt", ctx.get("le"))
        return f"{label} deve ser menor que {limit}." if limit is not None else f"{label} inválido."
    if error_type == "enum":
        return f"{label} inválido."
    if error_type == "uuid_parsing":
        return f"{label} inválido."
    return f"{label}: valor inválido."


def translate_validation_errors(errors: list[dict[str, Any]]) -> str:
    """Mensagem única a partir da lista de erros do Pydantic — o front só
    mostra uma linha de cada vez, então basta traduzir a primeira."""
    if not errors:
        return "Dados inválidos."
    return translate_pydantic_error(errors[0])
