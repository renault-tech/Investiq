import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./api-client", () => ({ apiClient: { get: vi.fn() } }));

import { apiClient } from "./api-client";
import { getInvoiceAnalytics } from "./cards-api";

const mockedGet = apiClient.get as ReturnType<typeof vi.fn>;

/** O Pydantic serializa Decimal como STRING. Os tipos aqui declaram number,
 * então o tsc não acusa nada e o erro só aparece em runtime como
 * "toFixed is not a function", derrubando o painel inteiro. */
describe("getInvoiceAnalytics", () => {
  beforeEach(() => mockedGet.mockReset());

  it("converte os Decimais que chegam como string em número", async () => {
    mockedGet.mockResolvedValue({
      data: {
        invoice_id: "inv-1",
        avg_amount: "192.20000000",
        category_breakdown: [
          { category_id: "c1", category: "Alimentação", amount: "152.30000000", delta_pct: "12.5000" },
        ],
        trend: [{ reference_month: "2026-06-01", total_amount: "192.20000000" }],
        findings: [{ kind: "uncategorized", title: "1 sem categoria", description: "…", amount: "39.90000000" }],
        top_items: [{ id: "i1", description: "MERCADO SILVA", amount: "152.30000000" }],
      },
    });

    const out = await getInvoiceAnalytics("inv-1");

    expect(out.avg_amount).toBe(192.2);
    expect(out.category_breakdown[0].amount).toBe(152.3);
    expect(out.category_breakdown[0].delta_pct).toBe(12.5);
    expect(out.trend[0].total_amount).toBe(192.2);
    expect(out.findings[0].amount).toBe(39.9);
    expect(out.top_items[0].amount).toBe(152.3);
    // o que de fato quebrava a tela antes
    expect(() => out.category_breakdown[0].delta_pct!.toFixed(0)).not.toThrow();
  });

  it("preserva null em delta_pct (sem histórico) em vez de virar 0", async () => {
    mockedGet.mockResolvedValue({
      data: {
        invoice_id: "inv-1",
        avg_amount: "0",
        category_breakdown: [{ category_id: null, category: "Sem categoria", amount: "10", delta_pct: null }],
        trend: [],
        findings: [{ kind: "duplicate", title: "x", description: "y", amount: null }],
        top_items: [],
      },
    });

    const out = await getInvoiceAnalytics("inv-1");
    expect(out.category_breakdown[0].delta_pct).toBeNull();
    expect(out.findings[0].amount).toBeNull();
  });
});
