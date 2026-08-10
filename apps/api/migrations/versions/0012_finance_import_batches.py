"""Finance import batches (OFX/CSV statement import)

Revision ID: 0012
Revises: 0011
Create Date: 2026-08-09
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '0012'
down_revision = '0011'
branch_labels = None
depends_on = None

_RLS_TABLES = ['finance_import_batches', 'finance_import_rows']


def upgrade() -> None:
    op.create_table(
        'finance_import_batches',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('bank_account_id', UUID(as_uuid=True), sa.ForeignKey('bank_accounts.id', ondelete='SET NULL'), nullable=True),
        sa.Column('file_name', sa.String(255), nullable=False),
        sa.Column('file_type', sa.String(10), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
    )
    op.create_index('ix_finance_import_batches_user_id', 'finance_import_batches', ['user_id'])

    op.create_table(
        'finance_import_rows',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('batch_id', UUID(as_uuid=True), sa.ForeignKey('finance_import_batches.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('transaction_date', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('amount', sa.Numeric(18, 8), nullable=False),
        sa.Column('transaction_type', sa.String(10), nullable=False),
        sa.Column('description', sa.String(255), nullable=False),
        sa.Column('external_id', sa.String(100), nullable=True),
        sa.Column('category_id', UUID(as_uuid=True), sa.ForeignKey('finance_categories.id', ondelete='SET NULL'), nullable=True),
        sa.Column('is_duplicate', sa.Boolean(), nullable=False, server_default=sa.text('FALSE')),
        sa.Column('duplicate_transaction_id', UUID(as_uuid=True), nullable=True),
        sa.Column('is_selected', sa.Boolean(), nullable=False, server_default=sa.text('TRUE')),
        sa.Column('created_transaction_id', UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
    )
    op.create_index('ix_finance_import_rows_batch_id', 'finance_import_rows', ['batch_id'])
    op.create_index('ix_finance_import_rows_user_id', 'finance_import_rows', ['user_id'])

    for table in _RLS_TABLES:
        op.execute(f'ALTER TABLE {table} ENABLE ROW LEVEL SECURITY')
        op.execute(f"""
            CREATE POLICY {table}_user_isolation ON {table}
            USING (user_id = current_setting('app.current_user_id', TRUE)::UUID)
        """)


def downgrade() -> None:
    for table in _RLS_TABLES:
        op.execute(f'DROP POLICY IF EXISTS {table}_user_isolation ON {table}')
    op.drop_table('finance_import_rows')
    op.drop_table('finance_import_batches')
