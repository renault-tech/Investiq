from contextlib import asynccontextmanager

import redis.asyncio as aioredis
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text

from src.config import settings
from src.database import AsyncSessionLocal
from src.shared.limiter import limiter
from src.shared.validation_messages import translate_validation_errors
from src.auth.router import router as auth_router
from src.portfolio.router import router as portfolio_router
from src.settings.router import router as settings_router
from src.ai.router import router as ai_router
from src.analysis.router import router as analysis_portfolios_router
from src.analysis.router import analysis_router as analysis_endpoints_router
from src.market_data.router import router as market_router
from src.finance.router import router as finance_router
from src.alerts.router import router as alerts_router
from src.notifications.router import router as notifications_router
from src.onboarding.router import router as onboarding_router
from src.workers.router import router as workers_router
from src.workers.scheduler import start_scheduler, stop_scheduler
from src.cards.router import router as cards_router
from src.reports.router import router as reports_router
from src.watchlist.router import router as watchlist_router

# cards' PDF invoice upload (src/cards/parser.py::_parse_pdf) imports pypdf
# lazily rather than at module level, purely as a defensive fallback: if it
# were ever missing from requirements.txt, the router and CSV invoice upload
# would still work, and PDF upload would fail with a clear message instead
# of the whole module disappearing. In practice pypdf ships unconditionally
# (pure Python, ~4MB installed, no native dependency chain like the
# pdfplumber it replaced), so that fallback shouldn't ever trigger.


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start background workers on startup; stop on shutdown."""
    if settings.ENABLE_SCHEDULER:
        start_scheduler()
    yield
    if settings.ENABLE_SCHEDULER:
        stop_scheduler()


app = FastAPI(title="InvestIQ API", version="0.1.0", lifespan=lifespan)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Sem isso, um 422 devolve o `msg` cru do Pydantic/email-validator em
    inglês ("value is not a valid email address: The part after..."), que
    o front só repassava pro usuário — a primeira tela que qualquer pessoa
    vê podia mostrar um erro de servidor em outro idioma. Mesmo formato de
    `detail` que `InvestIQException` já usa (`{code, message}`), então todo
    lugar no front que já lida com um 422 da API continua funcionando —
    só troca o texto cru por uma frase em português."""
    message = translate_validation_errors(exc.errors())
    return JSONResponse(
        status_code=422,
        content={"detail": {"code": "validation.error", "message": message}},
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.cors_origin],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["Authorization", "Content-Type"],
)

# Routers
app.include_router(auth_router, prefix="/api/v1")
app.include_router(portfolio_router, prefix="/api/v1")
app.include_router(settings_router, prefix="/api/v1")
app.include_router(ai_router, prefix="/api/v1")
app.include_router(analysis_portfolios_router, prefix="/api/v1")
app.include_router(analysis_endpoints_router, prefix="/api/v1")
app.include_router(market_router, prefix="/api/v1")
app.include_router(finance_router, prefix="/api/v1")
app.include_router(alerts_router, prefix="/api/v1")
app.include_router(notifications_router, prefix="/api/v1")
app.include_router(onboarding_router, prefix="/api/v1")
app.include_router(workers_router, prefix="/api/v1")
app.include_router(cards_router, prefix="/api/v1")
app.include_router(reports_router, prefix="/api/v1")
app.include_router(watchlist_router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}


@app.get("/health/db")
async def health_db():
    db_status = "ok"
    redis_status = "ok"

    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
    except Exception:
        db_status = "error"

    try:
        redis_client = aioredis.from_url(settings.REDIS_URL)
        try:
            await redis_client.ping()
        finally:
            await redis_client.aclose()
    except Exception:
        redis_status = "error"

    # Redis is a cache, not a source of truth — its absence degrades
    # performance, not correctness, so it shouldn't flip external
    # monitoring to "service down". Only the database gates overall health.
    healthy = db_status == "ok"
    body = {"status": "ok" if healthy else "error", "db": db_status, "redis": redis_status}
    return JSONResponse(status_code=200 if healthy else 503, content=body)
