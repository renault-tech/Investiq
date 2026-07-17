"""File parsing for card invoices — PDF (pdfplumber) and CSV, tolerant decoding."""
import io
import logging

logger = logging.getLogger(__name__)

MAX_FILE_BYTES = 5 * 1024 * 1024  # 5 MB
MAX_PDF_PAGES = 30


class InvoiceParseError(Exception):
    """Raised when a file cannot be turned into text."""


def parse_invoice_file(file_name: str, content: bytes) -> str:
    """Extract normalized raw text from an uploaded PDF or CSV invoice."""
    if len(content) > MAX_FILE_BYTES:
        raise InvoiceParseError("Arquivo maior que 5 MB")
    if not content:
        raise InvoiceParseError("Arquivo vazio")

    lower = (file_name or "").lower()
    if lower.endswith(".pdf") or content[:4] == b"%PDF":
        return _parse_pdf(content)
    if lower.endswith((".csv", ".txt")):
        return _parse_csv(content)
    raise InvoiceParseError("Formato não suportado — envie PDF ou CSV")


def _parse_pdf(content: bytes) -> str:
    try:
        import pdfplumber
    except ImportError as exc:
        raise InvoiceParseError("Suporte a PDF não instalado no servidor") from exc

    try:
        pages_text = []
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            if len(pdf.pages) > MAX_PDF_PAGES:
                raise InvoiceParseError(f"PDF com mais de {MAX_PDF_PAGES} páginas")
            for page in pdf.pages:
                text = page.extract_text() or ""
                if text.strip():
                    pages_text.append(text)
        raw = "\n".join(pages_text).strip()
    except InvoiceParseError:
        raise
    except Exception as exc:
        logger.warning("PDF parse failed: %s", exc)
        raise InvoiceParseError("Não foi possível ler o PDF (protegido ou corrompido?)") from exc

    if not raw:
        raise InvoiceParseError("PDF sem texto extraível (fatura escaneada como imagem?)")
    return raw


def _parse_csv(content: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            text = content.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    else:
        raise InvoiceParseError("Não foi possível decodificar o CSV")

    text = text.strip()
    if not text:
        raise InvoiceParseError("CSV vazio")
    return text
