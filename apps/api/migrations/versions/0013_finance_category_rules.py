"""Finance category rules (auto-categorization that learns)

Revision ID: 0013
Revises: 0012
Create Date: 2026-08-09
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '0013'
down_revision = '0012'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'finance_category_rules',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('pattern', sa.String(100), nullable=False),
        sa.Column('match_type', sa.String(10), nullable=False, server_default='exact'),
        sa.Column('category_id', UUID(as_uuid=True), sa.ForeignKey('finance_categories.id', ondelete='CASCADE'), nullable=False),
        sa.Column('source', sa.String(10), nullable=False, server_default='learned'),
        sa.Column('hit_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('last_used_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.UniqueConstraint('user_id', 'pattern', name='uq_finance_category_rules_user_pattern'),
    )
    op.create_index('ix_finance_category_rules_user_id', 'finance_category_rules', ['user_id'])

    op.execute('ALTER TABLE finance_category_rules ENABLE ROW LEVEL SECURITY')
    op.execute("""
        CREATE POLICY finance_category_rules_user_isolation ON finance_category_rules
        USING (user_id = current_setting('app.current_user_id', TRUE)::UUID)
    """)


def downgrade() -> None:
    op.execute('DROP POLICY IF EXISTS finance_category_rules_user_isolation ON finance_category_rules')
    op.drop_table('finance_category_rules')
