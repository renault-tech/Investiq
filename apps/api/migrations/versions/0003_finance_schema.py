"""Finance schema: categories, financial_transactions, audit_logs

Revision ID: 0003
Revises: 0002
Create Date: 2026-02-20
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- finance_categories ---
    op.create_table(
        'finance_categories',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('category_type', sa.String(10), nullable=False),
        # category_type: income | expense
        sa.Column('color', sa.String(7), nullable=True),    # hex color e.g. #FF5733
        sa.Column('icon', sa.String(50), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('TRUE')),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.UniqueConstraint('user_id', 'name', 'category_type', name='uq_finance_category_user_name_type'),
    )
    op.create_index('ix_finance_categories_user_id', 'finance_categories', ['user_id'])

    # --- financial_transactions ---
    op.create_table(
        'financial_transactions',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('category_id', UUID(as_uuid=True), sa.ForeignKey('finance_categories.id', ondelete='SET NULL'), nullable=True),
        sa.Column('bank_account_id', UUID(as_uuid=True), sa.ForeignKey('bank_accounts.id', ondelete='SET NULL'), nullable=True),
        sa.Column('transaction_type', sa.String(10), nullable=False),
        # transaction_type: income | expense | transfer
        sa.Column('amount', sa.Numeric(18, 8), nullable=False),
        sa.Column('currency', sa.String(10), nullable=False, server_default='BRL'),
        sa.Column('description', sa.String(255), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('transaction_date', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('is_recurring', sa.Boolean(), nullable=False, server_default=sa.text('FALSE')),
        sa.Column('recurrence_rule', sa.String(100), nullable=True),  # iCal RRULE
        sa.Column('tags', sa.Text(), nullable=True),  # JSON array of strings
        sa.Column('deleted_at', sa.TIMESTAMP(timezone=True), nullable=True),  # soft delete
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
    )
    op.create_index('ix_financial_transactions_user_id', 'financial_transactions', ['user_id'])
    op.create_index('ix_financial_transactions_date', 'financial_transactions', ['transaction_date'])
    op.create_index('ix_financial_transactions_category_id', 'financial_transactions', ['category_id'])
    op.create_index('ix_financial_transactions_bank_account_id', 'financial_transactions', ['bank_account_id'])
    # Partial index — excludes soft-deleted records from common queries
    op.create_index(
        'ix_financial_transactions_active',
        'financial_transactions',
        ['user_id', 'transaction_date'],
        postgresql_where=sa.text('deleted_at IS NULL'),
    )

    # --- audit_logs ---
    op.create_table(
        'audit_logs',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), nullable=True),   # NULL for system actions
        sa.Column('action', sa.String(100), nullable=False),
        sa.Column('table_name', sa.String(100), nullable=True),
        sa.Column('record_id', UUID(as_uuid=True), nullable=True),
        sa.Column('old_data', sa.Text(), nullable=True),   # JSON
        sa.Column('new_data', sa.Text(), nullable=True),   # JSON
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
    )
    op.create_index('ix_audit_logs_user_id', 'audit_logs', ['user_id'])
    op.create_index('ix_audit_logs_table_record', 'audit_logs', ['table_name', 'record_id'])
    op.create_index('ix_audit_logs_created_at', 'audit_logs', ['created_at'])

    # Enable RLS on user-data tables
    for table in ['finance_categories', 'financial_transactions']:
        op.execute(f'ALTER TABLE {table} ENABLE ROW LEVEL SECURITY')
        op.execute(f"""
            CREATE POLICY {table}_user_isolation ON {table}
            USING (user_id = current_setting('app.current_user_id', TRUE)::UUID)
        """)

    # Now that financial_transactions exists, add the FK from investment_transactions
    op.create_foreign_key(
        'fk_investment_transactions_finance_transaction',
        'investment_transactions',
        'financial_transactions',
        ['finance_transaction_id'],
        ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint(
        'fk_investment_transactions_finance_transaction',
        'investment_transactions',
        type_='foreignkey',
    )

    for table in ['finance_categories', 'financial_transactions']:
        op.execute(f'DROP POLICY IF EXISTS {table}_user_isolation ON {table}')

    op.drop_table('audit_logs')
    op.drop_table('financial_transactions')
    op.drop_table('finance_categories')
