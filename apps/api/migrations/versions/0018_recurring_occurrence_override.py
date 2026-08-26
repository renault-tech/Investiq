"""Recorrência: materializar uma ocorrência avulsa em linha editável

Até aqui uma ocorrência futura de recorrência era só uma data calculada em
memória (expand_recurring), sem linha própria — o vencimento variar alguns
dias (ex.: cai num fim de semana e desliza pro dia útil seguinte) não tinha
como ser registrado sem editar o template inteiro e mudar a série a partir
dali. `recurring_parent_id`/`recurring_occurrence_date` guardam, numa linha
real e independente, de qual template e de qual data originalmente prevista
essa ocorrência veio — o índice único evita materializar a mesma ocorrência
duas vezes (reabrir a mesma edição reaproveita a linha em vez de duplicar).

Revision ID: 0018
Revises: 0017
Create Date: 2026-08-26
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0018'
down_revision = '0017'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'financial_transactions',
        sa.Column('recurring_parent_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('financial_transactions.id', ondelete='CASCADE'), nullable=True),
    )
    op.add_column('financial_transactions', sa.Column('recurring_occurrence_date', sa.Date(), nullable=True))
    op.create_index(
        'ix_financial_transactions_recurring_parent_id', 'financial_transactions', ['recurring_parent_id'],
    )
    op.create_index(
        'uq_financial_transactions_recurring_occurrence',
        'financial_transactions', ['recurring_parent_id', 'recurring_occurrence_date'],
        unique=True, postgresql_where=sa.text('recurring_parent_id IS NOT NULL'),
    )


def downgrade() -> None:
    op.drop_index('uq_financial_transactions_recurring_occurrence', table_name='financial_transactions')
    op.drop_index('ix_financial_transactions_recurring_parent_id', table_name='financial_transactions')
    op.drop_column('financial_transactions', 'recurring_occurrence_date')
    op.drop_column('financial_transactions', 'recurring_parent_id')
