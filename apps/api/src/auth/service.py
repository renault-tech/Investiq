import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone


from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.auth.models import User, RefreshToken, PasswordResetToken, UserSettings
from src.auth.jwt import create_access_token
from src.config import settings
from src.shared.exceptions import ValidationError, UnauthorizedError

import bcrypt

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
) -> tuple[str, str]:
    """Returns (access_token, raw_refresh_token)."""
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        print(f"User not found for email: {email}")
        raise UnauthorizedError(f"User not found: {email}")
        
    if not verify_password(password, user.hashed_password):
        print(f"Password mismatch for email: {email}")
        raise UnauthorizedError("Password mismatch")
        
    if not user.is_active:
        print(f"User disabled: {email}")
        raise UnauthorizedError("Account disabled")

    access_token = create_access_token(str(user.id), user.email, user.role)
    raw_refresh = secrets.token_urlsafe(64)
    rt = RefreshToken(
        id=uuid.uuid4(),
        user_id=user.id,
        token_hash=hash_token(raw_refresh),
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(rt)
    await db.commit()
    return access_token, raw_refresh


async def refresh_access_token(
    raw_refresh_token: str,
    db: AsyncSession,
) -> tuple[str, str]:
    """Rotate refresh token. Returns (new_access_token, new_raw_refresh_token)."""
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
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(new_rt)
    await db.commit()
    return new_access, new_raw_refresh


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
