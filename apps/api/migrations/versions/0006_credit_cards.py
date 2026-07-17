"""Credit cards, invoices and invoice items (AI-extracted)

Revision ID: 0006
Revises: 0005
Create Date: 2026-07-17
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '0006'
down_revision = '0005'
branch_labels = None
depends_on = None

_RLS_TABLES = ['credit_cards', 'card_invoices', 'invoice_items']


def upgrade() -> None:
    op.create_table(
        'credit_cards',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('brand', sa.String(20), nullable=True),  # visa | mastercard | elo | amex | other
        sa.Column('last4', sa.String(4), nullable=True),
        sa.Column('credit_limit', sa.Numeric(18, 8), nullable=True),
        sa.Column('closing_day', sa.Integer(), nullable=True),
        sa.Column('due_day', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('TRUE')),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
    )
    op.create_index('ix_credit_cards_user_id', 'credit_cards', ['user_id'])

    op.create_table(
        'card_invoices',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('card_id', UUID(as_uuid=True), sa.ForeignKey('credit_cards.id', ondelete='CASCADE'), nullable=False),
        sa.Column('reference_month', sa.Date(), nullable=False),
        sa.Column('due_date', sa.Date(), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='processing'),
        # status: processing | review | confirmed | failed
        sa.Column('total_amount', sa.Numeric(18, 8), nullable=True),
        sa.Column('file_name', sa.String(255), nullable=True),
        sa.Column('raw_text', sa.Text(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.UniqueConstraint('card_id', 'reference_month', name='uq_card_invoices_card_month'),
    )
    op.create_index('ix_card_invoices_user_id', 'card_invoices', ['user_id'])
    op.create_index('ix_card_invoices_card_id', 'card_invoices', ['card_id'])

    op.create_table(
        'invoice_items',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('invoice_id', UUID(as_uuid=True), sa.ForeignKey('card_invoices.id', ondelete='CASCADE'), nullable=False),
        sa.Column('description', sa.String(255), nullable=False),
        sa.Column('amount', sa.Numeric(18, 8), nullable=False),
        sa.Column('purchase_date', sa.Date(), nullable=True),
        sa.Column('installment_no', sa.Integer(), nullable=True),
        sa.Column('installment_total', sa.Integer(), nullable=True),
        sa.Column('suggested_category_id', UUID(as_uuid=True), sa.ForeignKey('finance_categories.id', ondelete='SET NULL'), nullable=True),
        sa.Column('category_id', UUID(as_uuid=True), sa.ForeignKey('finance_categories.id', ondelete='SET NULL'), nullable=True),
        sa.Column('financial_transaction_id', UUID(as_uuid=True), nullable=True),
        sa.Column('is_ignored', sa.Boolean(), nullable=False, server_default=sa.text('FALSE')),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
    )
    op.create_index('ix_invoice_items_invoice_id', 'invoice_items', ['invoice_id'])
    op.create_index('ix_invoice_items_user_id', 'invoice_items', ['user_id'])

    for table in _RLS_TABLES:
        op.execute(f'ALTER TABLE {table} ENABLE ROW LEVEL SECURITY')
        op.execute(f"""
            CREATE POLICY {table}_user_isolation ON {table}
            USING (user_id = current_setting('app.current_user_id', TRUE)::UUID)
        """)


def downgrade() -> None:
    for table in _RLS_TABLES:
        op.execute(f'DROP POLICY IF EXISTS {table}_user_isolation ON {table}')
    op.drop_table('invoice_items')
    op.drop_table('card_invoices')
    op.drop_table('credit_cards')
