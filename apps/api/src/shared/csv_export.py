"""CSV export helpers — pt-BR Excel conventions: ';' separator, ',' decimal,
UTF-8 with BOM (so Excel on Windows detects encoding/accents correctly)."""
import csv
import io
from decimal import Decimal
from typing import Any, Iterable

from fastapi.responses import StreamingResponse


def _format_cell(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, Decimal):
        # 'f' avoids scientific notation — a zero read back from a
        # NUMERIC(18,8) column normalizes to Decimal('0E-8'), which str()
        # would render as the confusing "0E-8" instead of "0,00000000".
        return format(value, "f").replace(".", ",")
    return str(value)


def build_csv_response(filename: str, headers: list[str], rows: Iterable[list[Any]]) -> StreamingResponse:
    buffer = io.StringIO()
    buffer.write("﻿")  # BOM
    writer = csv.writer(buffer, delimiter=";")
    writer.writerow(headers)
    for row in rows:
        writer.writerow([_format_cell(cell) for cell in row])

    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
