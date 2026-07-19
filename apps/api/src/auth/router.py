import uuid

from fastapi import APIRouter, Depends, Response, Cookie, Request
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.auth import service
from src.auth.schemas import (
    RegisterRequest,
    LoginRequest,
    TokenResponse,
    UserResponse,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    SessionResponse,
    RevokeOtherSessionsResponse,
)
from src.auth.dependencies import get_current_user
from src.auth.models import User
from src.shared.limiter import limiter

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE = "refresh_token"
COOKIE_MAX_AGE = 30 * 24 * 3600  # 30 days


@router.post("/register", response_model=UserResponse, status_code=201)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    user = await service.register_user(body.email, body.password, body.full_name, db)
    return UserResponse(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        is_verified=user.is_verified,
        plan=user.plan,
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(
    request: Request,
    body: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    access_token, refresh_token = await service.login_user(
        body.email, body.password, db,
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    response.set_cookie(
        REFRESH_COOKIE,
        refresh_token,
        httponly=True,
        samesite="lax",
        max_age=COOKIE_MAX_AGE,
        secure=False,  # Set True in production (HTTPS)
    )
    return TokenResponse(access_token=access_token)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    request: Request,
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias=REFRESH_COOKIE),
    db: AsyncSession = Depends(get_db),
):
    from src.shared.exceptions import UnauthorizedError
    if not refresh_token:
        raise UnauthorizedError("No refresh token provided")
    new_access, new_refresh = await service.refresh_access_token(
        refresh_token, db,
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    response.set_cookie(
        REFRESH_COOKIE,
        new_refresh,
        httponly=True,
        samesite="lax",
        max_age=COOKIE_MAX_AGE,
        secure=False,
    )
    return TokenResponse(access_token=new_access)


@router.post("/logout")
async def logout(
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias=REFRESH_COOKIE),
    db: AsyncSession = Depends(get_db),
):
    await service.logout_user(refresh_token, db)
    response.delete_cookie(REFRESH_COOKIE)
    return {"message": "Logged out"}


@router.post("/forgot-password")
@limiter.limit("5/minute")
async def forgot_password(
    request: Request,
    body: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    await service.create_password_reset_token(body.email, db)
    return {"message": "If the email exists, a reset link has been sent"}


@router.post("/reset-password")
async def reset_password_endpoint(body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    await service.reset_password(body.token, body.new_password, db)
    return {"message": "Password reset successfully"}


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        is_verified=current_user.is_verified,
        plan=current_user.plan,
    )


@router.get("/sessions", response_model=list[SessionResponse])
async def list_sessions(
    current_user: User = Depends(get_current_user),
    refresh_token: str | None = Cookie(default=None, alias=REFRESH_COOKIE),
    db: AsyncSession = Depends(get_db),
):
    """Active sessions (devices) for the current user, most recent first."""
    return await service.list_sessions(current_user.id, refresh_token, db)


@router.delete("/sessions/{session_id}", status_code=204)
async def revoke_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Sign out a specific device/session (including — deliberately — the current one)."""
    await service.revoke_session(current_user.id, session_id, db)


@router.post("/sessions/revoke-others", response_model=RevokeOtherSessionsResponse)
async def revoke_other_sessions(
    current_user: User = Depends(get_current_user),
    refresh_token: str | None = Cookie(default=None, alias=REFRESH_COOKIE),
    db: AsyncSession = Depends(get_db),
):
    """Sign out every other device, keeping only the session making this request."""
    count = await service.revoke_other_sessions(current_user.id, refresh_token, db)
    return RevokeOtherSessionsResponse(revoked_count=count)
