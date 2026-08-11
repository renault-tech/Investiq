"""Watchlist items (tickers followed without a position)

Revision ID: 0014
Revises: 0013
Create Date: 2026-08-11
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '0014'
down_revision = '0013'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'watchlist_items',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('asset_id', UUID(as_uuid=True), sa.ForeignKey('assets.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.UniqueConstraint('user_id', 'asset_id', name='uq_watchlist_items_user_asset'),
    )
    op.create_index('ix_watchlist_items_user_id', 'watchlist_items', ['user_id'])
    op.create_index('ix_watchlist_items_asset_id', 'watchlist_items', ['asset_id'])

    op.execute('ALTER TABLE watchlist_items ENABLE ROW LEVEL SECURITY')
    op.execute("""
        CREATE POLICY watchlist_items_user_isolation ON watchlist_items
        USING (user_id = current_setting('app.current_user_id', TRUE)::UUID)
    """)


def downgrade() -> None:
    op.execute('DROP POLICY IF EXISTS watchlist_items_user_isolation ON watchlist_items')
    op.drop_table('watchlist_items')
