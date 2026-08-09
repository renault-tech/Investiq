"""Finance accounts, transfers, installments, transaction origin and FX hook

Revision ID: 0011
Revises: 0010
Create Date: 2026-08-09

Liga a tabela `bank_accounts` (criada em 0002 e nunca usada: zero endpoints,
zero leituras) e transforma `financial_transactions` num livro-caixa de
verdade — conta de origem/destino, parcelamento, origem do lançamento e
normalização cambial.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '0011'
down_revision = '0010'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ---------------------------------------------------------------- contas
    # `balance` era um saldo guardado que nunca foi mantido por ninguém. Vira
    # `opening_balance` (saldo anterior ao primeiro lançamento); o saldo real
    # passa a ser sempre derivado das transações.
    op.alter_column('bank_accounts', 'balance', new_column_name='opening_balance')

    op.add_column('bank_accounts', sa.Column('holder', sa.String(80), nullable=True))
    op.add_column('bank_accounts', sa.Column('color', sa.String(7), nullable=True))
    op.add_column('bank_accounts', sa.Column('icon', sa.String(50), nullable=True))
    op.add_column('bank_accounts', sa.Column(
        'include_in_total', sa.Boolean(), nullable=False, server_default=sa.text('TRUE')))
    op.add_column('bank_accounts', sa.Column(
        'portfolio_id', UUID(as_uuid=True),
        sa.ForeignKey('portfolios.id', ondelete='SET NULL'), nullable=True))

    op.create_unique_constraint('uq_bank_accounts_user_name', 'bank_accounts', ['user_id', 'name'])

    # RLS não é criada aqui: a 0002 já habilitou e criou
    # bank_accounts_user_isolation junto com a tabela (0002:150).

    # --------------------------------------------------- transações: colunas
    op.add_column('financial_transactions', sa.Column(
        'to_bank_account_id', UUID(as_uuid=True),
        sa.ForeignKey('bank_accounts.id', ondelete='SET NULL'), nullable=True))

    op.add_column('financial_transactions', sa.Column('installment_group_id', UUID(as_uuid=True), nullable=True))
    op.add_column('financial_transactions', sa.Column('installment_no', sa.Integer(), nullable=True))
    op.add_column('financial_transactions', sa.Column('installment_total', sa.Integer(), nullable=True))

    op.add_column('financial_transactions', sa.Column(
        'source', sa.String(20), nullable=False, server_default='manual'))
    op.add_column('financial_transactions', sa.Column('external_id', sa.String(100), nullable=True))

    # Câmbio travado no momento do lançamento: o histórico não pode mudar
    # quando a cotação muda. amount_brl é o que toda agregação passa a somar.
    op.add_column('financial_transactions', sa.Column(
        'fx_rate', sa.Numeric(18, 8), nullable=False, server_default='1'))
    op.add_column('financial_transactions', sa.Column('amount_brl', sa.Numeric(18, 8), nullable=True))

    op.execute('UPDATE financial_transactions SET amount_brl = amount WHERE amount_brl IS NULL')
    op.alter_column('financial_transactions', 'amount_brl', nullable=False)

    op.create_index('ix_financial_transactions_to_bank_account_id',
                    'financial_transactions', ['to_bank_account_id'])
    op.create_index('ix_financial_transactions_installment_group',
                    'financial_transactions', ['installment_group_id'])
    # Parcial: só linhas importadas têm external_id, e é o que garante que
    # reimportar o mesmo extrato não duplique nada.
    op.execute("""
        CREATE UNIQUE INDEX ix_financial_transactions_external_id
        ON financial_transactions (user_id, external_id)
        WHERE external_id IS NOT NULL
    """)

    # ------------------------------------------------------------- backfill
    # Toda transação já existente passa a pertencer a uma conta, senão os
    # saldos nasceriam ignorando o histórico.
    op.execute("""
        INSERT INTO bank_accounts (user_id, name, account_type, holder, opening_balance, currency, is_active)
        SELECT DISTINCT t.user_id, 'Conta principal', 'checking', NULL, 0, 'BRL', TRUE
        FROM financial_transactions t
        WHERE t.bank_account_id IS NULL
          AND NOT EXISTS (
              SELECT 1 FROM bank_accounts a
              WHERE a.user_id = t.user_id AND a.name = 'Conta principal'
          )
    """)
    op.execute("""
        UPDATE financial_transactions t
        SET bank_account_id = a.id
        FROM bank_accounts a
        WHERE t.bank_account_id IS NULL
          AND a.user_id = t.user_id
          AND a.name = 'Conta principal'
    """)


def downgrade() -> None:
    op.execute('DROP INDEX IF EXISTS ix_financial_transactions_external_id')
    op.drop_index('ix_financial_transactions_installment_group', table_name='financial_transactions')
    op.drop_index('ix_financial_transactions_to_bank_account_id', table_name='financial_transactions')

    for column in ('amount_brl', 'fx_rate', 'external_id', 'source',
                   'installment_total', 'installment_no', 'installment_group_id',
                   'to_bank_account_id'):
        op.drop_column('financial_transactions', column)

    op.drop_constraint('uq_bank_accounts_user_name', 'bank_accounts', type_='unique')

    for column in ('portfolio_id', 'include_in_total', 'icon', 'color', 'holder'):
        op.drop_column('bank_accounts', column)

    op.alter_column('bank_accounts', 'opening_balance', new_column_name='balance')
