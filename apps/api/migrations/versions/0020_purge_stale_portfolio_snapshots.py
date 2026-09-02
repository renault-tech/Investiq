"""Limpa todos os snapshots diários de carteira já gravados

Os cálculos que alimentam esses snapshots (conversão de câmbio na
reconstrução histórica, custo proporcional numa venda parcial, TWR contra
uma perda >100%, e o próprio câmbio gravado numa transação em moeda
estrangeira) tiveram bugs corrigidos em migrações de código anteriores —
mas um `PortfolioSnapshot` é um valor CONGELADO por dia, e nada nesse
código revisita um dia já gravado quando a lógica muda. Um snapshot escrito
com qualquer uma dessas contas erradas continua exibindo o valor errado no
gráfico de performance para sempre, mesmo depois do bug corrigido — só o
endpoint de reparo por carteira (POST /portfolios/{id}/audit/repair-fx)
limpava isso, e só quando o usuário clicava nele.

Sem uma forma confiável de saber quais linhas já gravadas são "limpas" (só
foram calculadas depois de todas as correções) e quais são "contaminadas",
a única correção que garante o gráfico certo pra todo mundo — sem depender
de cada usuário encontrar e clicar o botão de reparo — é apagar todas: o
próximo carregamento reconstrói cada dia a partir das transações com a
lógica já corrigida, e o job diário grava um snapshot novo e correto a
partir de amanhã.

Revision ID: 0020
Revises: 0019
Create Date: 2026-09-02
"""
from alembic import op

revision = '0020'
down_revision = '0019'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("DELETE FROM portfolio_snapshots")


def downgrade() -> None:
    # Dado apagado não volta — não há downgrade que não seja um no-op.
    pass
