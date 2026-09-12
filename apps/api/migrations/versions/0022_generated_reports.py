"""Cria generated_reports

Guarda cada relatório já baixado (tipo, formato, parâmetros e o arquivo em
si) para a lista "Relatórios gerados" em /reports mostrar histórico real
em vez de um calendário fixo dos últimos 6 meses.

Revision ID: 0022
Revises: 0021
Create Date: 2026-09-12
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0022'
down_revision = '0021'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "generated_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("report_type", sa.String(40), nullable=False),
        sa.Column("format", sa.String(10), nullable=False),
        sa.Column("params", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("file_name", sa.String(200), nullable=False),
        sa.Column("file_content", sa.LargeBinary, nullable=False),
        sa.Column("file_size", sa.Integer, nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_generated_reports_user_id", "generated_reports", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_generated_reports_user_id", table_name="generated_reports")
    op.drop_table("generated_reports")
