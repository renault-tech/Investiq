"""Add portfolio analysis models

Revision ID: 0004
Revises: 0003
Create Date: 2026-04-02
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- portfolio_analyses ---
    op.create_table(
        'portfolio_analyses',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('portfolio_id', UUID(as_uuid=True), sa.ForeignKey('portfolios.id'), nullable=False),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('raw_text', sa.Text(), nullable=False),
        sa.Column('sections', JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('provider', sa.String(length=50), nullable=True),
        sa.Column('model', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    )
    op.create_index(op.f('ix_portfolio_analyses_portfolio_id'), 'portfolio_analyses', ['portfolio_id'], unique=False)
    op.create_index(op.f('ix_portfolio_analyses_user_id'), 'portfolio_analyses', ['user_id'], unique=False)

    # --- analysis_messages ---
    op.create_table(
        'analysis_messages',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('analysis_id', UUID(as_uuid=True), sa.ForeignKey('portfolio_analyses.id'), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    )
    op.create_index(op.f('ix_analysis_messages_analysis_id'), 'analysis_messages', ['analysis_id'], unique=False)

    # Enable RLS for portfolio_analyses
    op.execute("ALTER TABLE portfolio_analyses ENABLE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY portfolio_analyses_user_isolation ON portfolio_analyses
        USING (user_id = current_setting('app.current_user_id', TRUE)::UUID)
    """)


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS portfolio_analyses_user_isolation ON portfolio_analyses")
    op.drop_index(op.f('ix_analysis_messages_analysis_id'), table_name='analysis_messages')
    op.drop_table('analysis_messages')
    op.drop_index(op.f('ix_portfolio_analyses_user_id'), table_name='portfolio_analyses')
    op.drop_index(op.f('ix_portfolio_analyses_portfolio_id'), table_name='portfolio_analyses')
    op.drop_table('portfolio_analyses')
