from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from src.config import settings
from src.shared.limiter import limiter
from src.auth.router import router as auth_router
from src.portfolio.router import router as portfolio_router
from src.settings.router import router as settings_router
from src.ai.router import router as ai_router
from src.analysis.router import router as analysis_portfolios_router
from src.analysis.router import analysis_router as analysis_endpoints_router
from src.workers.scheduler import start_scheduler, stop_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start background workers on startup; stop on shutdown."""
    # start_scheduler()
    yield
    # stop_scheduler()


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


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}


@app.get("/health/db")
async def health_db():
    return {"status": "ok", "db": "not_connected_yet"}
