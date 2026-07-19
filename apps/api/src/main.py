from contextlib import asynccontextmanager

import redis.asyncio as aioredis
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text

from src.config import settings
from src.database import AsyncSessionLocal
from src.shared.limiter import limiter
from src.auth.router import router as auth_router
from src.portfolio.router import router as portfolio_router
from src.settings.router import router as settings_router
from src.ai.router import router as ai_router
from src.analysis.router import router as analysis_portfolios_router
from src.analysis.router import analysis_router as analysis_endpoints_router
from src.market_data.router import router as market_router
from src.finance.router import router as finance_router
from src.cards.router import router as cards_router
from src.alerts.router import router as alerts_router
from src.notifications.router import router as notifications_router
from src.workers.scheduler import start_scheduler, stop_scheduler


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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
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
app.include_router(cards_router, prefix="/api/v1")
app.include_router(alerts_router, prefix="/api/v1")
app.include_router(notifications_router, prefix="/api/v1")


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

    redis_client = aioredis.from_url(settings.REDIS_URL)
    try:
        await redis_client.ping()
    except Exception:
        redis_status = "error"
    finally:
        await redis_client.aclose()

    healthy = db_status == "ok" and redis_status == "ok"
    body = {"status": "ok" if healthy else "error", "db": db_status, "redis": redis_status}
    return JSONResponse(status_code=200 if healthy else 503, content=body)
