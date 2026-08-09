import hashlib
import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone


from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.auth.models import User, RefreshToken, PasswordResetToken, UserSettings
from src.auth.jwt import create_access_token
from src.config import settings
from src.shared.exceptions import ValidationError, UnauthorizedError, NotFoundError

import bcrypt

logger = logging.getLogger(__name__)

# Precomputed dummy hash so verify_password always runs a real bcrypt
# comparison even when the account doesn't exist — keeping login's response
# time (and error message) identical for "no such account" and "wrong
# password" so neither the timing nor the message can be used to enumerate
# registered emails.
_DUMMY_HASH = bcrypt.hashpw(b"dummy-password-for-timing", bcrypt.gensalt()).decode("utf-8")


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def parse_device_label(user_agent: str | None) -> str:
    """Best-effort "Browser on OS" label from a User-Agent string.

    Not a real UA parser (no dependency added just for this) — just enough
    heuristic to make the sessions list human-readable. Falls back to a
    generic label rather than guessing wrong.
    """
    if not user_agent:
        return "Dispositivo desconhecido"
    ua = user_agent.lower()

    if "edg/" in ua:
        browser = "Edge"
    elif "opr/" in ua or "opera" in ua:
        browser = "Opera"
    elif "chrome/" in ua and "chromium" not in ua:
        browser = "Chrome"
    elif "firefox/" in ua:
        browser = "Firefox"
    elif "safari/" in ua and "chrome/" not in ua:
        browser = "Safari"
    else:
        browser = "Navegador"

    if "iphone" in ua or "ipad" in ua:
        os_name = "iOS"
    elif "android" in ua:
        os_name = "Android"
    elif "mac os" in ua or "macintosh" in ua:
        os_name = "macOS"
    elif "windows" in ua:
        os_name = "Windows"
    elif "linux" in ua:
        os_name = "Linux"
    else:
        os_name = "dispositivo desconhecido"

    return f"{browser} em {os_name}"


async def register_user(
    email: str,
    password: str,
    full_name: str | None,
    db: AsyncSession,
) -> User:
    result = await db.execute(select(User).where(User.email == email))
    if result.scalar_one_or_none():
        raise ValidationError("Email already registered")

    user = User(
        id=uuid.uuid4(),
        email=email,
        hashed_password=hash_password(password),
        full_name=full_name,
        role="user",
    )
    db.add(user)
    user_settings = UserSettings(user_id=user.id)
    db.add(user_settings)
    await db.commit()
    await db.refresh(user)
    return user


async def login_user(
    email: str,
    password: str,
    db: AsyncSession,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> tuple[str, str]:
    """Returns (access_token, raw_refresh_token)."""
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    # Same generic message and (via _DUMMY_HASH) same rough timing whether
    # the account doesn't exist, the password is wrong, or it's disabled —
    # none of those should be distinguishable from the response.
    if not user:
        verify_password(password, _DUMMY_HASH)
        logger.info("Login failed: no account for this email")
        raise UnauthorizedError("Invalid email or password")

    if not verify_password(password, user.hashed_password):
        logger.info("Login failed: wrong password for user_id=%s", user.id)
        raise UnauthorizedError("Invalid email or password")

    if not user.is_active:
        logger.info("Login failed: disabled account user_id=%s", user.id)
        raise UnauthorizedError("Invalid email or password")

    access_token = create_access_token(str(user.id), user.email, user.role)
    raw_refresh = secrets.token_urlsafe(64)
    rt = RefreshToken(
        id=uuid.uuid4(),
        user_id=user.id,
        token_hash=hash_token(raw_refresh),
        device_info=parse_device_label(user_agent),
        ip_address=ip_address,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(rt)
    await db.commit()
    return access_token, raw_refresh


async def refresh_access_token(
    raw_refresh_token: str,
    db: AsyncSession,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> tuple[str, str]:
    """Rotate refresh token. Returns (new_access_token, new_raw_refresh_token).

    The new row gets a fresh device_info/ip_address read from the request
    doing the refreshing — same device in practice, but this keeps the
    sessions list accurate if a session is ever refreshed from a different
    network/browser than it started on.
    """
    token_hash = hash_token(raw_refresh_token)
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > datetime.now(timezone.utc),
        )
    )
    rt = result.scalar_one_or_none()
    if not rt:
        raise UnauthorizedError("Invalid or expired refresh token")

    rt.revoked_at = datetime.now(timezone.utc)
    user_result = await db.execute(select(User).where(User.id == rt.user_id))
    user = user_result.scalar_one_or_none()
    if not user or not user.is_active:
        raise UnauthorizedError("User not found or disabled")

    new_access = create_access_token(str(user.id), user.email, user.role)
    new_raw_refresh = secrets.token_urlsafe(64)
    new_rt = RefreshToken(
        id=uuid.uuid4(),
        user_id=user.id,
        token_hash=hash_token(new_raw_refresh),
        device_info=parse_device_label(user_agent),
        ip_address=ip_address,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(new_rt)
    await db.commit()
    return new_access, new_raw_refresh


async def logout_user(raw_refresh_token: str | None, db: AsyncSession) -> None:
    """Revoke the refresh token server-side, not just the client-side cookie.

    Previously logout only cleared the cookie — the token itself stayed
    valid in the DB until natural expiry, so a captured cookie kept working
    after the user "logged out". Silent no-op if there's no cookie or it's
    already invalid, matching this module's logout being idempotent.
    """
    if not raw_refresh_token:
        return
    token_hash = hash_token(raw_refresh_token)
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked_at.is_(None),
        )
    )
    rt = result.scalar_one_or_none()
    if rt:
        rt.revoked_at = datetime.now(timezone.utc)
        await db.commit()


async def list_sessions(
    user_id: uuid.UUID, current_raw_refresh_token: str | None, db: AsyncSession
) -> list[dict]:
    """Active (non-revoked, non-expired) sessions, most recent first."""
    current_hash = hash_token(current_raw_refresh_token) if current_raw_refresh_token else None
    result = await db.execute(
        select(RefreshToken)
        .where(
            RefreshToken.user_id == user_id,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > datetime.now(timezone.utc),
        )
        .order_by(RefreshToken.created_at.desc())
    )
    return [
        {
            "id": rt.id,
            "device_info": rt.device_info,
            "ip_address": rt.ip_address,
            "created_at": rt.created_at,
            "expires_at": rt.expires_at,
            "is_current": rt.token_hash == current_hash,
        }
        for rt in result.scalars().all()
    ]


async def revoke_session(user_id: uuid.UUID, session_id: uuid.UUID, db: AsyncSession) -> None:
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.id == session_id,
            RefreshToken.user_id == user_id,
            RefreshToken.revoked_at.is_(None),
        )
    )
    rt = result.scalar_one_or_none()
    if not rt:
        raise NotFoundError("Sessão")
    rt.revoked_at = datetime.now(timezone.utc)
    await db.commit()


async def revoke_other_sessions(
    user_id: uuid.UUID, current_raw_refresh_token: str | None, db: AsyncSession
) -> int:
    """Revoke every active session except the one making this request. Returns the count revoked."""
    current_hash = hash_token(current_raw_refresh_token) if current_raw_refresh_token else None
    query = select(RefreshToken).where(
        RefreshToken.user_id == user_id,
        RefreshToken.revoked_at.is_(None),
        RefreshToken.expires_at > datetime.now(timezone.utc),
    )
    if current_hash:
        query = query.where(RefreshToken.token_hash != current_hash)
    result = await db.execute(query)
    sessions = result.scalars().all()
    now = datetime.now(timezone.utc)
    for rt in sessions:
        rt.revoked_at = now
    await db.commit()
    return len(sessions)


async def create_password_reset_token(email: str, db: AsyncSession) -> str | None:
    """Returns raw reset token if user exists, None if not (silent for security)."""
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        return None
    raw_token = secrets.token_urlsafe(32)
    prt = PasswordResetToken(
        id=uuid.uuid4(),
        user_id=user.id,
        token_hash=hash_token(raw_token),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )
    db.add(prt)
    await db.commit()
    return raw_token


async def reset_password(raw_token: str, new_password: str, db: AsyncSession) -> None:
    token_hash = hash_token(raw_token)
    result = await db.execute(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.expires_at > datetime.now(timezone.utc),
        )
    )
    prt = result.scalar_one_or_none()
    if not prt:
        raise ValidationError("Invalid or expired reset token")
    user_result = await db.execute(select(User).where(User.id == prt.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise ValidationError("User not found")
    user.hashed_password = hash_password(new_password)
    prt.used_at = datetime.now(timezone.utc)
    await db.commit()
