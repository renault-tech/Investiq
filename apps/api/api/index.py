"""Vercel Python entrypoint — re-exports the real FastAPI app.

Vercel's Python runtime loads whichever module exports `app` from a file
under api/. The actual application lives in src/main.py (same code used by
uvicorn locally and in the Docker image); this file only exists to satisfy
Vercel's convention.
"""
from src.main import app  # noqa: F401
