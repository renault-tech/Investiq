"""Adiciona risk_profile em user_settings

Perfil de risco declarado pelo usuário (conservador/moderado/arrojado),
usado em Metas (comparar alocação alvo do perfil com a alocação real da
carteira) e em Configurações (seção Perfil). Nula até o usuário escolher
um — sem perfil padrão fabricado.

Revision ID: 0021
Revises: 0020
Create Date: 2026-09-11
"""
from alembic import op
import sqlalchemy as sa

revision = '0021'
down_revision = '0020'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("user_settings", sa.Column("risk_profile", sa.Text(), nullable=True))
    op.create_check_constraint(
        "ck_user_settings_risk_profile",
        "user_settings",
        "risk_profile IS NULL OR risk_profile IN ('conservador', 'moderado', 'arrojado')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_user_settings_risk_profile", "user_settings", type_="check")
    op.drop_column("user_settings", "risk_profile")
