"""Notifications and finance budgets

Revision ID: 0007
Revises: 0006
Create Date: 2026-07-19
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '0007'
down_revision = '0006'
branch_labels = None
depends_on = None

_RLS_TABLES = ['notifications', 'finance_budgets']


def upgrade() -> None:
    op.create_table(
        'notifications',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('type', sa.String(50), nullable=False),
        # type: price_alert | budget_exceeded | system
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('body', sa.Text(), nullable=True),
        sa.Column('read_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
    )
    op.create_index('ix_notifications_user_read', 'notifications', ['user_id', 'read_at'])

    op.create_table(
        'finance_budgets',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('category_id', UUID(as_uuid=True), sa.ForeignKey('finance_categories.id', ondelete='CASCADE'), nullable=False),
        sa.Column('amount', sa.Numeric(18, 8), nullable=False),
        sa.Column('period', sa.String(10), nullable=False, server_default='monthly'),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.UniqueConstraint('user_id', 'category_id', name='uq_finance_budgets_user_category'),
    )
    op.create_index('ix_finance_budgets_user_id', 'finance_budgets', ['user_id'])

    for table in _RLS_TABLES:
        op.execute(f'ALTER TABLE {table} ENABLE ROW LEVEL SECURITY')
        op.execute(f"""
            CREATE POLICY {table}_user_isolation ON {table}
            USING (user_id = current_setting('app.current_user_id', TRUE)::UUID)
        """)


def downgrade() -> None:
    for table in _RLS_TABLES:
        op.execute(f'DROP POLICY IF EXISTS {table}_user_isolation ON {table}')
    op.drop_table('finance_budgets')
    op.drop_table('notifications')
