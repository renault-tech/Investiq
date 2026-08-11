"""Orçamento por carteira: bank_account_id em finance_budgets

Até aqui existia um orçamento por categoria e ponto — o mesmo teto valia
para todas as contas ao mesmo tempo, então quem administra a conta própria
e a de outra pessoa via os dois gastos somados contra um único limite. Com
`bank_account_id` o orçamento passa a pertencer a uma carteira; NULL segue
significando "consolidado" (vale para o total de todas), que é exatamente o
comportamento que as linhas existentes já tinham — daí o backfill ser um
no-op e nenhum orçamento mudar de sentido com esta migração.

A unique precisa de NULLS NOT DISTINCT (PG15+): sem isso o Postgres trata
cada NULL como valor único e o usuário conseguiria criar vários orçamentos
consolidados para a mesma categoria, cada um sobrescrevendo o anterior na
tela sem nunca colidir no banco.

Revision ID: 0016
Revises: 0015
Create Date: 2026-08-11
"""
from alembic import op
import sqlalchemy as sa

revision = '0016'
down_revision = '0015'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('finance_budgets', sa.Column(
        'bank_account_id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=True
    ))
    op.create_foreign_key(
        'fk_finance_budgets_bank_account', 'finance_budgets', 'bank_accounts',
        ['bank_account_id'], ['id'], ondelete='CASCADE',
    )
    op.drop_constraint('uq_finance_budgets_user_category', 'finance_budgets', type_='unique')
    op.execute(
        'ALTER TABLE finance_budgets ADD CONSTRAINT uq_finance_budgets_user_category '
        'UNIQUE NULLS NOT DISTINCT (user_id, category_id, bank_account_id)'
    )
    op.create_index(
        'ix_finance_budgets_bank_account', 'finance_budgets', ['bank_account_id']
    )


def downgrade() -> None:
    # Orçamentos de carteira específica não têm equivalente no esquema antigo
    # (um só teto por categoria) — manter os consolidados e descartar os de
    # carteira é a única redução que não inventa um limite que ninguém pediu.
    op.execute('DELETE FROM finance_budgets WHERE bank_account_id IS NOT NULL')
    op.drop_index('ix_finance_budgets_bank_account', table_name='finance_budgets')
    op.drop_constraint('uq_finance_budgets_user_category', 'finance_budgets', type_='unique')
    op.drop_constraint('fk_finance_budgets_bank_account', 'finance_budgets', type_='foreignkey')
    op.drop_column('finance_budgets', 'bank_account_id')
    op.create_unique_constraint(
        'uq_finance_budgets_user_category', 'finance_budgets', ['user_id', 'category_id']
    )
