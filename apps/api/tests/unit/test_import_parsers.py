"""Unit: parsers de extrato OFX (SGML e XML) e CSV."""
from decimal import Decimal

import pytest

from src.finance.import_parsers import _parse_amount, parse_csv, parse_ofx
from src.shared.exceptions import ValidationError

OFX_1X_SGML = """OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII

<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260615120000[-3:BRT]
<TRNAMT>-45.90
<FITID>202606150001
<MEMO>COMPRA CARTAO IFOOD
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260601090000[-3:BRT]
<TRNAMT>3500.00
<FITID>202606010001
<NAME>SALARIO EMPRESA XPTO
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>
"""

OFX_2X_XML = """<?xml version="1.0" encoding="UTF-8"?>
<?OFX OFXHEADER="200" VERSION="200" SECURITY="NONE" OLDFILEUID="NONE" NEWFILEUID="NONE"?>
<OFX>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <STMTRS>
        <BANKTRANLIST>
          <STMTTRN>
            <TRNTYPE>DEBIT</TRNTYPE>
            <DTPOSTED>20260610</DTPOSTED>
            <TRNAMT>-12.50</TRNAMT>
            <FITID>abc123</FITID>
            <MEMO>PADARIA CENTRO</MEMO>
          </STMTTRN>
        </BANKTRANLIST>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>
"""


def test_parse_ofx_1x_sgml_extracts_both_transactions():
    rows = parse_ofx(OFX_1X_SGML)
    assert len(rows) == 2

    expense = next(r for r in rows if r.transaction_type == "expense")
    assert expense.amount == Decimal("45.90")
    assert expense.external_id == "202606150001"
    assert "IFOOD" in expense.description
    assert expense.transaction_date.year == 2026 and expense.transaction_date.month == 6 and expense.transaction_date.day == 15

    income = next(r for r in rows if r.transaction_type == "income")
    assert income.amount == Decimal("3500.00")
    assert "SALARIO" in income.description


def test_parse_ofx_2x_xml():
    rows = parse_ofx(OFX_2X_XML)
    assert len(rows) == 1
    assert rows[0].transaction_type == "expense"
    assert rows[0].amount == Decimal("12.50")
    assert rows[0].external_id == "abc123"
    assert rows[0].transaction_date.day == 10


def test_parse_ofx_rejects_non_ofx_content():
    with pytest.raises(ValidationError):
        parse_ofx("isso não é um extrato")


def test_parse_csv_with_recognized_headers_ptbr():
    content = "Data;Descrição;Valor\n15/06/2026;IFOOD;-45,90\n01/06/2026;SALARIO;3500,00\n"
    rows = parse_csv(content)
    assert len(rows) == 2
    expense = next(r for r in rows if r.transaction_type == "expense")
    assert expense.amount == Decimal("45.90")
    assert expense.description == "IFOOD"


def test_parse_csv_positional_fallback_nubank_style():
    """Nubank exporta sem cabeçalho reconhecível de imediato em alguns apps:
    data, título, valor — o parser cai para esse formato posicional."""
    content = "2026-06-15,Ifood,-45.90\n2026-06-01,Salario,3500.00\n"
    rows = parse_csv(content)
    assert len(rows) == 2
    assert {r.amount for r in rows} == {Decimal("45.90"), Decimal("3500.00")}


def test_parse_csv_handles_ptbr_thousands_separator():
    content = "Data,Descricao,Valor\n01/06/2026,Aluguel,\"1.234,56\"\n"
    rows = parse_csv(content)
    assert rows[0].amount == Decimal("1234.56")


@pytest.mark.parametrize(
    "raw,expected",
    [
        # Vírgula é sempre decimal no padrão brasileiro.
        ("15,600", "15.6"),
        ("1.234,56", "1234.56"),
        ("1.234.567,89", "1234567.89"),
        # Ponto sozinho separando grupos de 3 é milhar — ler como decimal
        # dividia o lançamento por mil sem acusar erro.
        ("15.600", "15600"),
        ("1.234.567", "1234567"),
        # Ponto sozinho com 1 ou 2 casas continua sendo decimal.
        ("15.6", "15.6"),
        ("0.05", "0.05"),
        # en-US continua aceito quando o ponto vem depois da vírgula.
        ("1,234.56", "1234.56"),
        # Ruído de moeda.
        ("R$ 1.234,56", "1234.56"),
    ],
)
def test_parse_csv_number_separators_follow_ptbr(raw, expected):
    content = f'Data,Descricao,Valor\n01/06/2026,Teste,"{raw}"\n'
    rows = parse_csv(content)
    assert rows[0].amount == Decimal(expected)


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("-15.600", "-15600"),
        ("-1.234,56", "-1234.56"),
        ("(1.234,56)", "-1234.56"),  # notação contábil
        ("(R$ 50,00)", "-50"),
    ],
)
def test_parse_amount_keeps_sign(raw, expected):
    """O sinal só some no `parse_csv`, que o move para `transaction_type` e
    guarda o módulo — na leitura do número ele tem que sobreviver."""
    assert _parse_amount(raw) == Decimal(expected)


@pytest.mark.parametrize(
    "raw,transaction_type",
    [
        ("-15.600", "expense"),
        ("(1.234,56)", "expense"),
        ("1.234,56", "income"),
    ],
)
def test_parse_csv_moves_sign_into_transaction_type(raw, transaction_type):
    content = f'Data,Descricao,Valor\n01/06/2026,Teste,"{raw}"\n'
    rows = parse_csv(content)
    assert rows[0].transaction_type == transaction_type
    assert rows[0].amount > 0


def test_parse_csv_rejects_unrecognizable_format():
    with pytest.raises(ValidationError):
        parse_csv("coluna_unica\nvalor1\nvalor2\n")


def test_parse_csv_rejects_empty_file():
    with pytest.raises(ValidationError):
        parse_csv("")
