import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./api-client", () => ({ apiClient: { get: vi.fn() } }));

import { apiClient } from "./api-client";
import { getActionCenter } from "./actions-api";

const mockedGet = apiClient.get as ReturnType<typeof vi.fn>;

/** `amount` e `total_amount` são Decimal no Pydantic, e Decimal vira STRING
 * no JSON. Os tipos declaram number, então o tsc passa e a quebra só
 * apareceria em runtime — o dropdown chama formatBRLCompact, que faz conta
 * com o valor. */
describe("getActionCenter", () => {
  beforeEach(() => mockedGet.mockReset());

  it("converte os Decimais que chegam como string em número", async () => {
    mockedGet.mockResolvedValue({
      data: {
        total_amount: "6000.00000000",
        items: [
          {
            id: "tx:1", kind: "bill_overdue", title: "Pequena vencida",
            description: "Venceu há 2 dia(s)", amount: "1000.00000000",
            due_date: "2026-09-08", href: "/transactions",
          },
          {
            id: "tx:2", kind: "bill_due", title: "Grande a vencer",
            description: "Vence em 5 dia(s)", amount: "5000.00000000",
            due_date: "2026-09-15", href: "/transactions",
          },
        ],
      },
    });

    const out = await getActionCenter();

    expect(out.total_amount).toBe(6000);
    expect(out.items.map((i) => i.amount)).toEqual([1000, 5000]);
    // o resto do item passa intacto
    expect(out.items[0].kind).toBe("bill_overdue");
    expect(out.items[0].href).toBe("/transactions");
  });

  it("preserva amount null (fatura sem valor não vira 0 nem NaN)", async () => {
    mockedGet.mockResolvedValue({
      data: {
        total_amount: "0",
        items: [
          {
            id: "invoice-uncat:1", kind: "invoice_uncategorized",
            title: "2 lançamento(s) sem categoria", description: "…",
            amount: null, due_date: null, href: "/finances/cards",
          },
        ],
      },
    });

    const out = await getActionCenter();

    expect(out.items[0].amount).toBeNull();
    expect(out.total_amount).toBe(0);
  });

  it("aguenta uma resposta sem items", async () => {
    mockedGet.mockResolvedValue({ data: { total_amount: "0" } });
    await expect(getActionCenter()).resolves.toMatchObject({ items: [], total_amount: 0 });
  });
});
