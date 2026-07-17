"""Daily portfolio value snapshots

Revision ID: 0005
Revises: 0004
Create Date: 2026-07-17
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'portfolio_snapshots',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('portfolio_id', UUID(as_uuid=True), sa.ForeignKey('portfolios.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('snapshot_date', sa.Date(), nullable=False),
        sa.Column('total_value', sa.Numeric(18, 8), nullable=False),
        sa.Column('total_invested', sa.Numeric(18, 8), nullable=False),
        sa.Column('total_pnl', sa.Numeric(18, 8), nullable=False),
        sa.Column('currency', sa.String(10), nullable=False, server_default='BRL'),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.UniqueConstraint('portfolio_id', 'snapshot_date', name='uq_portfolio_snapshots_portfolio_date'),
    )
    op.create_index('ix_portfolio_snapshots_portfolio_date', 'portfolio_snapshots', ['portfolio_id', 'snapshot_date'])
    op.create_index('ix_portfolio_snapshots_user_id', 'portfolio_snapshots', ['user_id'])

    op.execute('ALTER TABLE portfolio_snapshots ENABLE ROW LEVEL SECURITY')
    op.execute("""
        CREATE POLICY portfolio_snapshots_user_isolation ON portfolio_snapshots
        USING (user_id = current_setting('app.current_user_id', TRUE)::UUID)
    """)


def downgrade() -> None:
    op.execute('DROP POLICY IF EXISTS portfolio_snapshots_user_isolation ON portfolio_snapshots')
    op.drop_index('ix_portfolio_snapshots_portfolio_date', 'portfolio_snapshots')
    op.drop_index('ix_portfolio_snapshots_user_id', 'portfolio_snapshots')
    op.drop_table('portfolio_snapshots')
