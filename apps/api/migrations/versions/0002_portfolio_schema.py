"""Portfolio schema: assets, portfolios, positions, transactions, bank_accounts, fx_rates

Revision ID: 0002
Revises: 0001
Create Date: 2026-02-20
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- assets (shared lookup table) ---
    op.create_table(
        'assets',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('ticker', sa.String(20), nullable=False),
        sa.Column('exchange', sa.String(20), nullable=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('asset_type', sa.String(30), nullable=False),
        # asset_type: stock_br | stock_us | fii | reit | etf | crypto | commodity | fixed_income_br | other
        sa.Column('country', sa.String(10), nullable=True),
        sa.Column('sector', sa.String(100), nullable=True),
        sa.Column('currency', sa.String(10), nullable=False, server_default='BRL'),
        sa.Column('last_price', sa.Numeric(18, 8), nullable=True),
        sa.Column('last_price_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
    )
    op.create_index('ix_assets_ticker', 'assets', ['ticker'])
    op.create_index('ix_assets_ticker_exchange', 'assets', ['ticker', 'exchange'], unique=True)

    # --- portfolios ---
    op.create_table(
        'portfolios',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('currency', sa.String(10), nullable=False, server_default='BRL'),
        sa.Column('is_default', sa.Boolean(), nullable=False, server_default=sa.text('FALSE')),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
    )
    op.create_index('ix_portfolios_user_id', 'portfolios', ['user_id'])

    # --- bank_accounts ---
    op.create_table(
        'bank_accounts',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('institution', sa.String(100), nullable=True),
        sa.Column('account_type', sa.String(20), nullable=False, server_default='checking'),
        # account_type: checking | savings | investment | broker
        sa.Column('balance', sa.Numeric(18, 8), nullable=False, server_default=sa.text('0')),
        sa.Column('currency', sa.String(10), nullable=False, server_default='BRL'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('TRUE')),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
    )
    op.create_index('ix_bank_accounts_user_id', 'bank_accounts', ['user_id'])

    # --- portfolio_positions ---
    op.create_table(
        'portfolio_positions',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('portfolio_id', UUID(as_uuid=True), sa.ForeignKey('portfolios.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('asset_id', UUID(as_uuid=True), sa.ForeignKey('assets.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('broker', sa.String(100), nullable=True),
        sa.Column('quantity', sa.Numeric(18, 8), nullable=False, server_default=sa.text('0')),
        sa.Column('avg_cost', sa.Numeric(18, 8), nullable=False, server_default=sa.text('0')),
        sa.Column('total_invested', sa.Numeric(18, 8), nullable=False, server_default=sa.text('0')),
        sa.Column('target_weight', sa.Numeric(5, 4), nullable=True),
        sa.Column('target_value_brl', sa.Numeric(18, 8), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.UniqueConstraint('portfolio_id', 'asset_id', 'broker', name='uq_position_portfolio_asset_broker'),
    )
    op.create_index('ix_portfolio_positions_portfolio_id', 'portfolio_positions', ['portfolio_id'])
    op.create_index('ix_portfolio_positions_user_id', 'portfolio_positions', ['user_id'])

    # --- investment_transactions ---
    op.create_table(
        'investment_transactions',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('position_id', UUID(as_uuid=True), sa.ForeignKey('portfolio_positions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('transaction_type', sa.String(20), nullable=False),
        # transaction_type: buy | sell | dividend | split | bonus
        sa.Column('quantity', sa.Numeric(18, 8), nullable=False),
        sa.Column('unit_price', sa.Numeric(18, 8), nullable=False),
        sa.Column('fees', sa.Numeric(18, 8), nullable=False, server_default=sa.text('0')),
        sa.Column('fx_rate', sa.Numeric(18, 8), nullable=False, server_default=sa.text('1')),
        sa.Column('total_amount', sa.Numeric(18, 8), nullable=False),
        sa.Column('transaction_date', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('finance_transaction_id', UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
    )
    op.create_index('ix_investment_transactions_position_id', 'investment_transactions', ['position_id'])
    op.create_index('ix_investment_transactions_user_id', 'investment_transactions', ['user_id'])
    op.create_index('ix_investment_transactions_date', 'investment_transactions', ['transaction_date'])

    # --- price_alerts ---
    op.create_table(
        'price_alerts',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('asset_id', UUID(as_uuid=True), sa.ForeignKey('assets.id', ondelete='CASCADE'), nullable=False),
        sa.Column('alert_type', sa.String(20), nullable=False),
        # alert_type: price_above | price_below | pct_change_up | pct_change_down
        sa.Column('threshold', sa.Numeric(18, 8), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('TRUE')),
        sa.Column('triggered_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
    )
    op.create_index('ix_price_alerts_user_id', 'price_alerts', ['user_id'])
    op.create_index('ix_price_alerts_asset_id', 'price_alerts', ['asset_id'])

    # --- fx_rates ---
    op.create_table(
        'fx_rates',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('from_currency', sa.String(10), nullable=False),
        sa.Column('to_currency', sa.String(10), nullable=False),
        sa.Column('rate', sa.Numeric(18, 8), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.UniqueConstraint('from_currency', 'to_currency', 'date', name='uq_fx_rates_pair_date'),
    )
    op.create_index('ix_fx_rates_pair_date', 'fx_rates', ['from_currency', 'to_currency', 'date'])

    # Enable RLS on user-data tables
    for table in ['portfolios', 'bank_accounts', 'portfolio_positions', 'investment_transactions', 'price_alerts']:
        op.execute(f'ALTER TABLE {table} ENABLE ROW LEVEL SECURITY')
        op.execute(f"""
            CREATE POLICY {table}_user_isolation ON {table}
            USING (user_id = current_setting('app.current_user_id', TRUE)::UUID)
        """)


def downgrade() -> None:
    for table in ['portfolios', 'bank_accounts', 'portfolio_positions', 'investment_transactions', 'price_alerts']:
        op.execute(f'DROP POLICY IF EXISTS {table}_user_isolation ON {table}')

    op.drop_table('fx_rates')
    op.drop_table('price_alerts')
    op.drop_table('investment_transactions')
    op.drop_table('portfolio_positions')
    op.drop_table('bank_accounts')
    op.drop_table('portfolios')
    op.drop_table('assets')
