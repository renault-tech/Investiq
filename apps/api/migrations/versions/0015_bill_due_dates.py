"""Contas a pagar: due_date separado de transaction_date, is_paid/paid_at

Até aqui `transaction_date` era ao mesmo tempo "quando lancei" e "quando
pago" — não dava para registrar hoje uma conta que só vence daqui a duas
semanas e controlar o pagamento dela separadamente. `due_date` cobre esse
vencimento (backfillado com transaction_date para o histórico existente,
que sempre foi "lançado = pago no ato"); `is_paid`/`paid_at` controlam se
o botão "Pagar" da linha já foi clicado; `bill_notified_at` evita o worker
de vencimento notificar a mesma conta em duas execuções.

Revision ID: 0015
Revises: 0014
Create Date: 2026-08-11
"""
from alembic import op
import sqlalchemy as sa

revision = '0015'
down_revision = '0014'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('financial_transactions', sa.Column('due_date', sa.TIMESTAMP(timezone=True), nullable=True))
    op.execute('UPDATE financial_transactions SET due_date = transaction_date WHERE due_date IS NULL')
    op.alter_column('financial_transactions', 'due_date', nullable=False)

    op.add_column('financial_transactions', sa.Column(
        'is_paid', sa.Boolean(), nullable=False, server_default=sa.text('TRUE')
    ))
    op.add_column('financial_transactions', sa.Column('paid_at', sa.TIMESTAMP(timezone=True), nullable=True))
    op.execute('UPDATE financial_transactions SET paid_at = transaction_date WHERE is_paid IS TRUE')
    op.add_column('financial_transactions', sa.Column('bill_notified_at', sa.TIMESTAMP(timezone=True), nullable=True))

    op.create_index('ix_financial_transactions_due_date', 'financial_transactions', ['due_date'])


def downgrade() -> None:
    op.drop_index('ix_financial_transactions_due_date', table_name='financial_transactions')
    op.drop_column('financial_transactions', 'bill_notified_at')
    op.drop_column('financial_transactions', 'paid_at')
    op.drop_column('financial_transactions', 'is_paid')
    op.drop_column('financial_transactions', 'due_date')
