"""Unit: parsers de extrato OFX (SGML e XML) e CSV."""
from decimal import Decimal

import pytest

from src.finance.import_parsers import parse_csv, parse_ofx
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


def test_parse_csv_rejects_unrecognizable_format():
    with pytest.raises(ValidationError):
        parse_csv("coluna_unica\nvalor1\nvalor2\n")


def test_parse_csv_rejects_empty_file():
    with pytest.raises(ValidationError):
        parse_csv("")
