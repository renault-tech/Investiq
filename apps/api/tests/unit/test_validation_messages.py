"""Unit: tradução de erros de validação do Pydantic para pt-BR."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from pydantic import BaseModel, EmailStr, Field
from typing import Optional

from src.shared.validation_messages import translate_pydantic_error, translate_validation_errors


class _Model(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    age: int
    name: Optional[str] = None


def _errors(**kwargs) -> list[dict]:
    try:
        _Model(**kwargs)
        raise AssertionError("esperava ValidationError")
    except Exception as exc:
        return exc.errors()


def test_missing_field_in_portuguese():
    errors = _errors()
    msg = translate_pydantic_error(next(e for e in errors if e["loc"] == ("email",)))
    assert msg == "E-mail é obrigatório."


def test_invalid_email_does_not_leak_the_raw_english_validator_message():
    errors = _errors(email="a@localhost", password="12345678", age=1)
    msg = translate_pydantic_error(errors[0])
    assert "value is not a valid email address" not in msg
    assert "E-mail" in msg
    assert "informe um e-mail real" in msg


def test_string_too_short_includes_the_minimum():
    errors = _errors(email="a@b.com", password="123", age=1)
    msg = translate_pydantic_error(next(e for e in errors if e["loc"] == ("password",)))
    assert msg == "Senha muito curto (mínimo 8 caracteres)."


def test_int_parsing_in_portuguese():
    # "age" não está no dicionário de rótulos do app (nenhum schema real usa
    # esse nome) — cai no fallback genérico, que já é o comportamento certo
    # pra um campo desconhecido: mostra o nome, só sem tradução perfeita.
    errors = _errors(email="a@b.com", password="12345678", age="not-a-number")
    msg = translate_pydantic_error(next(e for e in errors if e["loc"] == ("age",)))
    assert msg == "Age deve ser um número."


def test_unknown_field_falls_back_to_capitalized_snake_case():
    error = {"loc": ("some_custom_field",), "type": "greater_than", "msg": "...", "ctx": {"gt": 0}}
    assert translate_pydantic_error(error) == "Some custom field deve ser maior que 0."


def test_translate_validation_errors_uses_only_the_first_error():
    errors = _errors()  # três campos faltando de uma vez
    assert len(errors) >= 2
    message = translate_validation_errors(errors)
    # Uma frase só — o front mostra uma linha, não uma lista.
    assert message.count(".") == 1


def test_translate_validation_errors_handles_empty_list():
    assert translate_validation_errors([]) == "Dados inválidos."


def test_error_pointing_at_a_list_index_uses_generic_label():
    # loc = ("items", 2, "amount") — índice de array, não nome de campo.
    error = {"loc": ("items", 2), "type": "missing", "msg": "Field required"}
    assert translate_pydantic_error(error) == "Campo é obrigatório."
