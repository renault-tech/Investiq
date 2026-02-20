"""Initial schema - users and user_settings

Revision ID: 0001
Revises:
Create Date: 2026-02-19
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable pgcrypto for gen_random_uuid()
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')

    op.create_table(
        "users",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("hashed_password", sa.Text()),
        sa.Column("full_name", sa.Text()),
        sa.Column("avatar_url", sa.Text()),
        sa.Column("role", sa.Text(), nullable=False, server_default="user"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("plan", sa.Text(), nullable=False, server_default="free"),
        sa.Column("plan_expires_at", sa.TIMESTAMP(timezone=True)),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )

    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.Text(), nullable=False),
        sa.Column("device_info", sa.Text()),
        sa.Column("expires_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.TIMESTAMP(timezone=True)),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.UniqueConstraint("token_hash", name="uq_refresh_tokens_hash"),
    )

    op.create_table(
        "password_reset_tokens",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("used_at", sa.TIMESTAMP(timezone=True)),
        sa.UniqueConstraint("token_hash", name="uq_password_reset_tokens_hash"),
    )

    op.create_table(
        "user_settings",
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("theme", sa.Text(), nullable=False, server_default="dark"),
        sa.Column("accent_color", sa.Text(), nullable=False, server_default="#3B82F6"),
        sa.Column("font_size_scale", sa.Numeric(4, 2), nullable=False, server_default="1.0"),
        sa.Column("base_currency", sa.Text(), nullable=False, server_default="BRL"),
        sa.Column("preferred_provider", sa.Text(), nullable=False, server_default="yahoo"),
        sa.Column("preferred_llm", sa.Text(), nullable=False, server_default="claude"),
        sa.Column("llm_model", sa.Text()),
        sa.Column("claude_api_key", sa.Text()),
        sa.Column("openai_api_key", sa.Text()),
        sa.Column("gemini_api_key", sa.Text()),
        sa.Column("alpha_vantage_key", sa.Text()),
        sa.Column("brapi_key", sa.Text()),
        sa.Column("polygon_key", sa.Text()),
        sa.Column("notify_price_alerts", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("notify_email", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )


def downgrade() -> None:
    op.drop_table("user_settings")
    op.drop_table("password_reset_tokens")
    op.drop_table("refresh_tokens")
    op.drop_table("users")
