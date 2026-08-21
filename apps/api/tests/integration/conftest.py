"""Integration test fixtures — real Postgres + Redis, ASGI transport, no mocks
below the HTTP boundary except the LLM provider (never call a real LLM in CI).

Requires a local Postgres reachable at TEST_DATABASE_URL (default:
postgresql+asyncpg://postgres:postgres@localhost:5432/investiq_test) and Redis
at TEST_REDIS_URL (default redis://localhost:6379/1, DB 1 to stay out of the
way of a dev instance on DB 0). The target database name must contain "test"
as a safety net against accidentally pointing this at a real database.
"""
import os
import uuid

# Environment must be set before importing anything under `src` — settings are
# read once at import time via pydantic-settings.
os.environ.setdefault(
    "DATABASE_URL",
    os.environ.get("TEST_DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/investiq_test"),
)
os.environ.setdefault("REDIS_URL", os.environ.get("TEST_REDIS_URL", "redis://localhost:6379/1"))
os.environ.setdefault("ENABLE_SCHEDULER", "false")
os.environ.setdefault("FRONTEND_URL", "http://localhost:3000")

if "test" not in os.environ["DATABASE_URL"].rsplit("/", 1)[-1]:
    raise RuntimeError(
        "Refusing to run integration tests: DATABASE_URL does not point at a "
        "database with 'test' in its name. Set TEST_DATABASE_URL explicitly."
    )

if "JWT_PRIVATE_KEY" not in os.environ or "JWT_PUBLIC_KEY" not in os.environ:
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import rsa

    _key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    os.environ["JWT_PRIVATE_KEY"] = _key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode()
    os.environ["JWT_PUBLIC_KEY"] = _key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode()

if "ENCRYPTION_KEY" not in os.environ:
    from cryptography.fernet import Fernet

    os.environ["ENCRYPTION_KEY"] = Fernet.generate_key().decode()

import pytest
import pytest_asyncio
from alembic import command
from alembic.config import Config as AlembicConfig
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

# All requests in these tests come from the same ASGI transport "IP", so the
# production per-IP rate limits (auth/login, /ai/analyze, invoice upload...)
# would otherwise throttle the suite itself rather than the app under test.
from src.shared.limiter import limiter as _limiter

_limiter.enabled = False

API_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Tables truncated between tests, in FK-safe order (children before parents).
# users/refresh_tokens/user_settings are left alone — each test registers its
# own user(s) with unique emails instead of relying on a shared fixture row.
_DATA_TABLES = [
    "invoice_items", "card_invoices", "credit_cards",
    "analysis_messages", "portfolio_analyses",
    "portfolio_snapshots", "investment_transactions", "portfolio_positions",
    "price_alerts", "watchlist_items", "bank_accounts", "portfolios", "assets", "fx_rates",
    "audit_logs", "financial_transactions", "finance_categories",
]


@pytest.fixture(scope="session", autouse=True)
def _migrate_database():
    """Run Alembic migrations against the test database once per test session."""
    alembic_cfg = AlembicConfig(os.path.join(API_DIR, "alembic.ini"))
    alembic_cfg.set_main_option("script_location", os.path.join(API_DIR, "migrations"))
    command.upgrade(alembic_cfg, "head")
    yield


@pytest_asyncio.fixture(autouse=True)
async def _clean_tables(_migrate_database):
    """Truncate user-data tables before each test for isolation.

    pytest-asyncio gives each test function a fresh event loop by default, but
    src.database.engine is a module-level singleton created once at import
    time — its asyncpg pool binds connections to whichever loop first used
    them. Disposing the pool here (first thing every test does) forces fresh
    connections to be opened against the CURRENT test's loop instead of
    reusing ones bound to a previous, now-closed loop.
    """
    from src.database import AsyncSessionLocal, engine

    await engine.dispose()
    async with AsyncSessionLocal() as session:
        await session.execute(text(f"TRUNCATE TABLE {', '.join(_DATA_TABLES)} CASCADE"))
        await session.commit()
    yield


@pytest_asyncio.fixture(autouse=True)
async def _clean_redis():
    """Flush the test Redis DB before each test.

    Market-data caching (quotes/histórico/fundamentals) keys purely by
    ticker+period+interval, with no per-test namespace. Without a flush here,
    a fake price series cached by one test under, say, "^BVSP" survives (both
    across tests in the same run AND across separate pytest invocations,
    since Redis persists on disk) and gets served back to a later test that
    expects a different provider's data for the same ticker — flaky failures
    that depend on run order/history rather than on the test's own setup.
    """
    import redis.asyncio as aioredis

    from src.config import settings

    redis_client = aioredis.from_url(settings.REDIS_URL)
    await redis_client.flushdb()
    await redis_client.aclose()
    yield


@pytest_asyncio.fixture
async def client():
    """httpx AsyncClient wired directly to the FastAPI app via ASGI transport."""
    from src.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test/api/v1") as ac:
        yield ac


@pytest_asyncio.fixture
async def db_session():
    """Direct DB access for test setup/assertions beyond what the API exposes."""
    from src.database import AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        yield session


class _NullMarketDataProvider:
    """Devolve "sem cotação" para tudo, na hora — nunca toca rede de verdade.

    Sem isso, todo teste que passa por resumo de carteira (dezenas na
    suíte) tenta uma chamada real ao Yahoo/Brapi antes de degradar. Neste
    sandbox local ela falha rápido (proxy sem egress rejeita em <1s), mas
    num runner de CI com internet de verdade o Yahoo bloqueia IP de
    datacenter de forma lenta em vez de rejeitar na hora — cada teste paga
    o timeout inteiro (mesmo limitado) antes de cair no fallback, e a
    soma disso é o que travava a suíte de integração por 15+ minutos.
    Testes que precisam de um preço específico já seedam `asset.last_price`
    direto no banco (o mesmo fallback que get_portfolio_summary usa quando
    a cotação ao vivo não está disponível), então nenhum deles depende de
    uma resposta real daqui.
    """

    name = "null"

    async def get_quote(self, ticker: str):
        return None

    async def get_quotes(self, tickers: list[str]) -> dict:
        return {}

    async def get_historical(self, ticker: str, period: str = "1y", interval: str = "1d") -> list:
        return []

    async def get_fundamentals(self, ticker: str):
        return None

    async def get_fund_composition(self, ticker: str):
        return None


@pytest.fixture(autouse=True)
def _no_real_market_data(monkeypatch):
    """Substitui get_provider nos cinco módulos que o importam diretamente
    (import direto vincula o nome no namespace de cada um — não basta
    remendar src.market_data.factory)."""
    fake = lambda *args, **kwargs: _NullMarketDataProvider()  # noqa: E731
    for module in (
        "src.portfolio.service",
        "src.watchlist.service",
        "src.portfolio.look_through",
        "src.market_data.router",
        "src.workers.price_refresh",
    ):
        monkeypatch.setattr(f"{module}.get_provider", fake)


def unique_email(prefix: str = "user") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}@example.com"


async def register_and_login(client: AsyncClient, *, password: str = "senhaSegura123", full_name: str = "Test User") -> dict:
    """Register a fresh user and return {'headers', 'email', 'user_id'}."""
    email = unique_email()
    reg = await client.post("/auth/register", json={"email": email, "password": password, "full_name": full_name})
    assert reg.status_code == 201, reg.text
    login = await client.post("/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    return {
        "headers": {"Authorization": f"Bearer {token}"},
        "email": email,
        "user_id": reg.json()["id"],
    }
