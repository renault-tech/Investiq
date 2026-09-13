// Adicionar a apps/web/src/lib/cards-api.ts (mesmo arquivo)

export interface CategoryBreakdownSlice {
  category_id: string | null;
  category: string;
  amount: number;
  delta_pct: number | null;
}

export interface InvoiceTrendPoint {
  reference_month: string;
  total_amount: number;
}

export interface InvoiceFinding {
  kind: "duplicate" | "category_spike" | "uncategorized";
  title: string;
  description: string;
  amount: number | null;
}

export interface InvoiceAnalytics {
  invoice_id: string;
  category_breakdown: CategoryBreakdownSlice[];
  trend: InvoiceTrendPoint[];
  avg_amount: number;
  top_items: InvoiceItem[];
  findings: InvoiceFinding[];
}

export async function getInvoiceAnalytics(invoiceId: string): Promise<InvoiceAnalytics> {
  const res = await apiClient.get<InvoiceAnalytics>(`/cards/invoices/${invoiceId}/analytics`);
  return res.data;
}
