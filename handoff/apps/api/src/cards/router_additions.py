# Adicionar ao apps/api/src/cards/router.py — import "from src.cards import analytics"
# no topo, e InvoiceAnalyticsResponse na lista de imports de schemas. Endpoint
# na mesma seção das rotas de /invoices/{invoice_id}/...

@router.get("/invoices/{invoice_id}/analytics", response_model=InvoiceAnalyticsResponse)
async def get_invoice_analytics(
    invoice_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Breakdown por categoria, tendência das últimas faturas do mesmo cartão,
    maiores gastos e achados (duplicidade, categoria acima do normal, itens
    sem categoria) — tudo calculado sob demanda, sem tabela nova."""
    return await analytics.get_invoice_analytics(invoice_id, current_user.id, db)
