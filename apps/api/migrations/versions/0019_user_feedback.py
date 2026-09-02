"""Feedback de usuário

Canal de retorno dentro do próprio produto: sem isso, um problema encontrado
no meio de uma tela só chega se a pessoa sair do app e procurar outro meio de
avisar — o que quase ninguém faz. `page_path` guarda de onde o relato saiu,
já que "isso aqui está errado" depende inteiramente do lugar.

Revision ID: 0019
Revises: 0018
Create Date: 2026-08-27
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0019'
down_revision = '0018'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'user_feedback',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('category', sa.String(20), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('page_path', sa.String(200), nullable=True),
        sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_user_feedback_user_id', 'user_feedback', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_user_feedback_user_id', table_name='user_feedback')
    op.drop_table('user_feedback')
