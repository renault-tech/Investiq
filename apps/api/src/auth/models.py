from sqlalchemy import Column, Text, Boolean, TIMESTAMP, ForeignKey, func, Numeric
from sqlalchemy.dialects.postgresql import UUID
from src.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True)
    email = Column(Text, nullable=False, unique=True)
    hashed_password = Column(Text)
    full_name = Column(Text)
    avatar_url = Column(Text)
    role = Column(Text, nullable=False, default="user")
    is_active = Column(Boolean, nullable=False, default=True)
    is_verified = Column(Boolean, nullable=False, default=False)
    plan = Column(Text, nullable=False, default="free")
    plan_expires_at = Column(TIMESTAMP(timezone=True))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(Text, nullable=False, unique=True)
    device_info = Column(Text)
    expires_at = Column(TIMESTAMP(timezone=True), nullable=False)
    revoked_at = Column(TIMESTAMP(timezone=True))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(Text, nullable=False, unique=True)
    expires_at = Column(TIMESTAMP(timezone=True), nullable=False)
    used_at = Column(TIMESTAMP(timezone=True))


class UserSettings(Base):
    __tablename__ = "user_settings"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    theme = Column(Text, nullable=False, default="dark")
    accent_color = Column(Text, nullable=False, default="#3B82F6")
    font_size_scale = Column(Numeric(4, 2), nullable=False, default=1.0)
    base_currency = Column(Text, nullable=False, default="BRL")
    preferred_provider = Column(Text, nullable=False, default="yahoo")
    preferred_llm = Column(Text, nullable=False, default="claude")
    llm_model = Column(Text)
    claude_api_key = Column(Text)
    openai_api_key = Column(Text)
    gemini_api_key = Column(Text)
    alpha_vantage_key = Column(Text)
    brapi_key = Column(Text)
    polygon_key = Column(Text)
    notify_price_alerts = Column(Boolean, nullable=False, default=True)
    notify_email = Column(Boolean, nullable=False, default=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
