from typing import Optional

from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from src.database import get_db
from src.auth.jwt import decode_access_token
from src.auth.models import User
from src.shared.exceptions import UnauthorizedError, ForbiddenError

# auto_error=False porque o padrão do HTTPBearer responde 403 quando o header
# Authorization está ausente, e o interceptor do frontend só renova a sessão
# em 401 — um reload de página (que perde o token da memória) virava uma
# enxurrada de 403 que nunca disparava o refresh, derrubando o usuário para
# o login. Ausência de credencial é 401, não 403.
bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    if credentials is None:
        raise UnauthorizedError("Not authenticated")
    try:
        payload = decode_access_token(credentials.credentials)
    except Exception:
        raise UnauthorizedError("Invalid or expired token")
    result = await db.execute(select(User).where(User.id == payload["sub"]))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise UnauthorizedError()
    return user


async def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise ForbiddenError()
    return user
