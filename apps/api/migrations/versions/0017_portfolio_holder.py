"""Titular em portfolios: holder

Investimentos ganham o mesmo rótulo livre de titular que bank_accounts já
tem desde a 0011 — sem isso, quem administra a carteira de outra pessoa via
Finanças (contas separadas por titular) não tinha como separar os
investimentos dela dos próprios na Visão Geral e em Investimentos. NULL
continua significando "sem titular definido", agrupado como "Eu" na tela.

Revision ID: 0017
Revises: 0016
Create Date: 2026-08-25
"""
from alembic import op
import sqlalchemy as sa

revision = '0017'
down_revision = '0016'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('portfolios', sa.Column('holder', sa.String(80), nullable=True))


def downgrade() -> None:
    op.drop_column('portfolios', 'holder')
