import os

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool
from src.config import settings

# statement_cache_size=0: asyncpg's client-side prepared-statement cache
# breaks against PgBouncer/Supavisor-style poolers (e.g. Supabase) since the
# underlying server connection can change between statements. Harmless for a
# direct connection (self-hosted Postgres), so applied unconditionally.
_engine_kwargs = {"echo": False, "connect_args": {"statement_cache_size": 0}}
if os.environ.get("VERCEL"):
    # Serverless: don't hold a local pool across invocations — rely on the
    # upstream pooler (Supavisor) instead. Vercel sets VERCEL=1 at runtime.
    _engine_kwargs["poolclass"] = NullPool

engine = create_async_engine(settings.DATABASE_URL, **_engine_kwargs)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
