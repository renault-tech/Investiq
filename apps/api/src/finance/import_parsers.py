"""Parsers de extrato bancário — OFX (SGML/XML) e CSV. Stdlib só: a função
serverless já tem teto de bundle, e nenhum dos dois formatos precisa de mais
que xml.etree e csv.
"""
import csv
import io
import re
import unicodedata
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from difflib import SequenceMatcher
from typing import Literal, Optional

from src.shared.exceptions import ValidationError


@dataclass
class ParsedRow:
    transaction_date: datetime
    amount: Decimal              # sempre positivo — o sinal vira transaction_type
    transaction_type: Literal["income", "expense"]
    description: str
    external_id: Optional[str] = None   # FITID do OFX; CSV não tem id estável


# ---------------------------------------------------------------------------
# OFX
# ---------------------------------------------------------------------------
#
# OFX 2.x é XML bem formado. OFX 1.x é SGML: tags de valor não são fechadas
# ("<TRNAMT>-45.90" sem "</TRNAMT>") e blocos repetidos como <STMTTRN> não têm
# fechamento entre uma ocorrência e a próxima. _sgml_to_xml normaliza os dois
# casos antes de entregar para xml.etree, sem precisar de uma lib externa.

_TAG_LINE = re.compile(r"^<(/?)([A-Za-z0-9.]+)>(.*)$")


def _xml_escape(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _sgml_to_xml(body: str) -> str:
    stack: list[str] = []
    out: list[str] = []
    for raw_line in body.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        match = _TAG_LINE.match(line)
        if not match:
            out.append(_xml_escape(line))
            continue
        closing, tag, rest = match.groups()
        if closing:
            # Fecha tudo que ficou aberto até (e incluindo) esta tag — cobre
            # o caso comum de um <STMTTRN> nunca fechado antes de </BANKTRANLIST>.
            while stack and stack[-1] != tag:
                out.append(f"</{stack.pop()}>")
            if stack:
                out.append(f"</{stack.pop()}>")
            continue
        if rest:
            out.append(f"<{tag}>{_xml_escape(rest)}</{tag}>")
        else:
            # Container repetido sem fechamento entre irmãos: <STMTTRN><STMTTRN>...
            if stack and stack[-1] == tag:
                out.append(f"</{stack.pop()}>")
            out.append(f"<{tag}>")
            stack.append(tag)
    while stack:
        out.append(f"</{stack.pop()}>")
    return "".join(out)


def _child_text(node: ET.Element, name: str) -> Optional[str]:
    for child in node:
        local = child.tag.rsplit("}", 1)[-1]  # tolera namespace, se houver
        if local.upper() == name:
            return (child.text or "").strip() or None
    return None


def _parse_ofx_date(raw: str) -> datetime:
    # "20260615120000[-3:BRT]" ou apenas "20260615"
    digits = raw.split("[")[0].strip()
    year, month, day = int(digits[0:4]), int(digits[4:6]), int(digits[6:8])
    hour = int(digits[8:10]) if len(digits) >= 10 else 12
    minute = int(digits[10:12]) if len(digits) >= 12 else 0
    second = int(digits[12:14]) if len(digits) >= 14 else 0
    return datetime(year, month, day, hour, minute, second, tzinfo=timezone.utc)


def parse_ofx(content: str) -> list[ParsedRow]:
    start = content.upper().find("<OFX")
    if start == -1:
        raise ValidationError("Arquivo não parece ser um OFX válido (tag <OFX> não encontrada)")
    body = content[start:]

    try:
        root = ET.fromstring(body)
    except ET.ParseError:
        try:
            root = ET.fromstring(_sgml_to_xml(body))
        except ET.ParseError as exc:
            raise ValidationError("Não foi possível interpretar o arquivo OFX") from exc

    rows: list[ParsedRow] = []
    for node in root.iter():
        if node.tag.rsplit("}", 1)[-1].upper() != "STMTTRN":
            continue
        raw_amount = _child_text(node, "TRNAMT")
        raw_date = _child_text(node, "DTPOSTED")
        if not raw_amount or not raw_date:
            continue
        try:
            amount = Decimal(raw_amount.replace(",", "."))
        except InvalidOperation:
            continue
        if amount == 0:
            continue
        description = _child_text(node, "NAME") or _child_text(node, "MEMO") or "Transação importada"
        rows.append(ParsedRow(
            transaction_date=_parse_ofx_date(raw_date),
            amount=abs(amount),
            transaction_type="income" if amount > 0 else "expense",
            description=description,
            external_id=_child_text(node, "FITID"),
        ))
    return rows


# ---------------------------------------------------------------------------
# CSV
# ---------------------------------------------------------------------------
#
# Detecção de colunas por nome do cabeçalho (com sinônimos pt-BR/en); se não
# achar, cai no formato posicional data,descrição,valor — que é exatamente o
# que Nubank, Inter e a maioria dos bancos digitais exportam.

_DATE_HEADERS = {"data", "date", "datalancamento", "dataoperacao"}
_DESC_HEADERS = {"descricao", "description", "titulo", "historico", "memo", "estabelecimento"}
_AMOUNT_HEADERS = {"valor", "amount", "valorrs", "valorbrl"}


def _normalize_header(raw: str) -> str:
    decomposed = unicodedata.normalize("NFKD", raw.strip().lower())
    without_accents = "".join(c for c in decomposed if not unicodedata.combining(c))
    return re.sub(r"[^a-z]", "", without_accents)


def _parse_amount(raw: str) -> Decimal:
    """Valor monetário de um CSV, no padrão brasileiro.

    Mesma regra de desempate do `parseBRNumber` do frontend, para o mesmo
    texto virar o mesmo número nos dois lados: com os dois separadores, o
    último é o decimal; só vírgula é decimal ("15,600" = 15,6); só ponto é
    milhar quando separa grupos de exatamente 3 dígitos ("15.600" = 15600)
    e decimal caso contrário ("15.6" = 15,6).
    """
    s = raw.strip().replace("R$", "").replace("r$", "").strip()
    negative = s.startswith("(") and s.endswith(")")
    if negative:
        s = s[1:-1]
    s = s.replace(" ", "").replace(" ", "")
    if "," in s and "." in s:
        if s.rfind(",") > s.rfind("."):
            s = s.replace(".", "").replace(",", ".")   # pt-BR: 1.234,56
        else:
            s = s.replace(",", "")                       # en: 1,234.56
    elif "," in s:
        s = s.replace(",", ".")
    elif "." in s:
        # Ponto sozinho é ambíguo. "15.600" num extrato brasileiro é quinze
        # mil e seiscentos, não quinze e seis — a leitura decimal aqui
        # dividia o lançamento por mil silenciosamente.
        parts = s.lstrip("-+").split(".")
        if len(parts) > 1 and all(len(p) == 3 for p in parts[1:]) and parts[0]:
            s = s.replace(".", "")
    value = Decimal(s)
    return -value if negative else value


def _parse_csv_date(raw: str) -> datetime:
    raw = raw.strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            parsed = datetime.strptime(raw, fmt)
            return parsed.replace(hour=12, tzinfo=timezone.utc)
        except ValueError:
            continue
    raise ValidationError(f"Data '{raw}' não reconhecida — use AAAA-MM-DD ou DD/MM/AAAA")


def parse_csv(content: str) -> list[ParsedRow]:
    try:
        dialect = csv.Sniffer().sniff(content[:4096], delimiters=",;\t")
    except csv.Error:
        dialect = csv.excel  # vírgula — fallback razoável quando o Sniffer não decide
    reader = csv.reader(io.StringIO(content), dialect)
    all_rows = [r for r in reader if any(cell.strip() for cell in r)]
    if not all_rows:
        raise ValidationError("Arquivo CSV vazio")

    header = [_normalize_header(cell) for cell in all_rows[0]]
    date_col = next((i for i, h in enumerate(header) if h in _DATE_HEADERS), None)
    desc_col = next((i for i, h in enumerate(header) if h in _DESC_HEADERS), None)
    amount_col = next((i for i, h in enumerate(header) if h in _AMOUNT_HEADERS), None)

    if date_col is not None and amount_col is not None:
        data_rows = all_rows[1:]
    elif len(all_rows[0]) >= 3:
        # Sem cabeçalho reconhecível: assume o formato posicional mais comum.
        date_col, desc_col, amount_col = 0, 1, 2
        data_rows = all_rows
    else:
        raise ValidationError(
            "Não foi possível identificar as colunas de data e valor. "
            "Exporte no formato: data, descrição, valor."
        )

    rows: list[ParsedRow] = []
    for cells in data_rows:
        if len(cells) <= max(date_col, amount_col):
            continue
        try:
            amount = _parse_amount(cells[amount_col])
        except InvalidOperation:
            continue
        if amount == 0:
            continue
        description = cells[desc_col].strip() if desc_col is not None and desc_col < len(cells) else ""
        rows.append(ParsedRow(
            transaction_date=_parse_csv_date(cells[date_col]),
            amount=abs(amount),
            transaction_type="income" if amount > 0 else "expense",
            description=description or "Transação importada",
        ))
    if not rows:
        raise ValidationError("Nenhuma transação reconhecida no arquivo")
    return rows


def description_similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a.upper(), b.upper()).ratio()
