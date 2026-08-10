"""Exportação de transações em OFX 2.x — puro XML pela stdlib, sem
dependência nova (o par de `import_parsers.parse_ofx`, na direção contrária).
"""
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

_TRNTYPE = {"income": "CREDIT", "expense": "DEBIT", "transfer": "XFER"}


def _sub(parent: ET.Element, tag: str, text: str) -> ET.Element:
    el = ET.SubElement(parent, tag)
    el.text = text
    return el


def _ofx_datetime(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.strftime("%Y%m%d%H%M%S")


def build_ofx_export(items: list[dict[str, Any]]) -> str:
    now = datetime.now(timezone.utc)
    dates = [item["transaction_date"] for item in items] or [now]

    ofx = ET.Element("OFX")
    signon = ET.SubElement(ET.SubElement(ofx, "SIGNONMSGSRSV1"), "SONRS")
    status = ET.SubElement(signon, "STATUS")
    _sub(status, "CODE", "0")
    _sub(status, "SEVERITY", "INFO")
    _sub(signon, "DTSERVER", _ofx_datetime(now))
    _sub(signon, "LANGUAGE", "POR")

    stmttrnrs = ET.SubElement(ET.SubElement(ofx, "BANKMSGSRSV1"), "STMTTRNRS")
    _sub(stmttrnrs, "TRNUID", "1")
    trn_status = ET.SubElement(stmttrnrs, "STATUS")
    _sub(trn_status, "CODE", "0")
    _sub(trn_status, "SEVERITY", "INFO")

    stmtrs = ET.SubElement(stmttrnrs, "STMTRS")
    _sub(stmtrs, "CURDEF", "BRL")
    acct = ET.SubElement(stmtrs, "BANKACCTFROM")
    _sub(acct, "BANKID", "0")
    _sub(acct, "ACCTID", "INVESTIQ")
    _sub(acct, "ACCTTYPE", "CHECKING")

    tranlist = ET.SubElement(stmtrs, "BANKTRANLIST")
    _sub(tranlist, "DTSTART", _ofx_datetime(min(dates)))
    _sub(tranlist, "DTEND", _ofx_datetime(max(dates)))

    for item in items:
        stmttrn = ET.SubElement(tranlist, "STMTTRN")
        _sub(stmttrn, "TRNTYPE", _TRNTYPE.get(item["transaction_type"], "OTHER"))
        _sub(stmttrn, "DTPOSTED", _ofx_datetime(item["transaction_date"]))
        signed = Decimal(str(item["amount"]))
        if item["transaction_type"] == "expense":
            signed = -signed
        _sub(stmttrn, "TRNAMT", format(signed, "f"))
        _sub(stmttrn, "FITID", str(item["id"]).replace(":", "-"))
        _sub(stmttrn, "NAME", (item["description"] or "Transação")[:255])
        if item["category_name"]:
            _sub(stmttrn, "MEMO", item["category_name"])

    body = ET.tostring(ofx, encoding="unicode")
    header = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<?OFX OFXHEADER="200" VERSION="200" SECURITY="NONE" '
        'OLDFILEUID="NONE" NEWFILEUID="NONE"?>\n'
    )
    return header + body
