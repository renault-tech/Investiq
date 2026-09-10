// Adicionar a apps/web/src/hooks/useCards.ts (mesmo arquivo) — importar
// getInvoiceAnalytics de "@/lib/cards-api" junto com os demais imports.

export function useInvoiceAnalytics(invoiceId: string | null) {
  return useQuery({
    queryKey: ["cards", "invoice", invoiceId, "analytics"],
    queryFn: () => getInvoiceAnalytics(invoiceId as string),
    enabled: invoiceId !== null,
    staleTime: 30_000,
  });
}
