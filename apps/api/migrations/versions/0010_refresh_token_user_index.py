"""Index refresh_tokens.user_id — list/revoke session queries filter on it directly
and the table only grows (rows are revoked, never deleted), so without this every
session-management call was a full table scan.

Revision ID: 0010
Revises: 0009
Create Date: 2026-08-09
"""
from alembic import op
import sqlalchemy as sa

revision = '0010'
down_revision = '0009'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Partial: list_sessions/revoke_session/revoke_other_sessions all filter
    # revoked_at IS NULL, so excluding revoked rows keeps the index small as
    # the table accumulates history.
    op.create_index(
        'ix_refresh_tokens_user_id_active',
        'refresh_tokens',
        ['user_id'],
        postgresql_where=sa.text('revoked_at IS NULL'),
    )


def downgrade() -> None:
    op.drop_index('ix_refresh_tokens_user_id_active', table_name='refresh_tokens')
