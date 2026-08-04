"""Finance savings goals

Revision ID: 0008
Revises: 0007
Create Date: 2026-07-19
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '0008'
down_revision = '0007'
branch_labels = None
depends_on = None

_RLS_TABLES = ['finance_goals', 'finance_goal_contributions']


def upgrade() -> None:
    op.create_table(
        'finance_goals',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('target_amount', sa.Numeric(18, 8), nullable=False),
        sa.Column('current_amount', sa.Numeric(18, 8), nullable=False, server_default='0'),
        sa.Column('target_date', sa.Date(), nullable=True),
        sa.Column('color', sa.String(7), nullable=True),
        sa.Column('icon', sa.String(50), nullable=True),
        sa.Column('is_archived', sa.Boolean(), nullable=False, server_default=sa.text('FALSE')),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
    )
    op.create_index('ix_finance_goals_user_id', 'finance_goals', ['user_id'])

    op.create_table(
        'finance_goal_contributions',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('goal_id', UUID(as_uuid=True), sa.ForeignKey('finance_goals.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('amount', sa.Numeric(18, 8), nullable=False),
        sa.Column('note', sa.String(255), nullable=True),
        sa.Column('contributed_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
    )
    op.create_index('ix_finance_goal_contributions_goal_id', 'finance_goal_contributions', ['goal_id'])
    op.create_index('ix_finance_goal_contributions_user_id', 'finance_goal_contributions', ['user_id'])

    for table in _RLS_TABLES:
        op.execute(f'ALTER TABLE {table} ENABLE ROW LEVEL SECURITY')
        op.execute(f"""
            CREATE POLICY {table}_user_isolation ON {table}
            USING (user_id = current_setting('app.current_user_id', TRUE)::UUID)
        """)


def downgrade() -> None:
    for table in _RLS_TABLES:
        op.execute(f'DROP POLICY IF EXISTS {table}_user_isolation ON {table}')
    op.drop_table('finance_goal_contributions')
    op.drop_table('finance_goals')
