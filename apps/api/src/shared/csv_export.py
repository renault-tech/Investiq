"""CSV export helpers — pt-BR Excel conventions: ';' separator, ',' decimal,
UTF-8 with BOM (so Excel on Windows detects encoding/accents correctly)."""
import csv
import io
from decimal import Decimal
from typing import Any, Iterable

from fastapi.responses import StreamingResponse


def format_csv_cell(value: Any) -> str:
    """Convenção pt-BR de Excel usada em toda exportação CSV do app: vírgula
    decimal, sem notação científica. Pública porque relatórios com seções de
    largura variável (ex.: relatório fiscal) não cabem em build_csv_bytes
    (que espera um único cabeçalho fixo) e precisam montar as linhas com
    csv.writer diretamente — mas ainda usando esta mesma formatação."""
    if value is None:
        return ""
    if isinstance(value, Decimal):
        # 'f' avoids scientific notation — a zero read back from a
        # NUMERIC(18,8) column normalizes to Decimal('0E-8'), which str()
        # would render as the confusing "0E-8" instead of "0,00000000".
        return format(value, "f").replace(".", ",")
    return str(value)


def build_csv_bytes(headers: list[str], rows: Iterable[list[Any]]) -> bytes:
    buffer = io.StringIO()
    buffer.write("﻿")  # BOM
    writer = csv.writer(buffer, delimiter=";")
    writer.writerow(headers)
    for row in rows:
        writer.writerow([format_csv_cell(cell) for cell in row])
    return buffer.getvalue().encode("utf-8")


def build_csv_response(filename: str, headers: list[str], rows: Iterable[list[Any]]) -> StreamingResponse:
    content = build_csv_bytes(headers, rows)
    return StreamingResponse(
        iter([content]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
