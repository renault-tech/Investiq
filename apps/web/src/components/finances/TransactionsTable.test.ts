import { describe, expect, it } from "vitest";
import { sortTransactions } from "./TransactionsTable";
import type { FinanceTransaction } from "@/lib/finance-api";

/** Só os campos que a ordenação lê; o resto do tipo não interessa aqui. */
function txn(over: Partial<FinanceTransaction>): FinanceTransaction {
  return {
    id: over.id ?? "x",
    due_date: "2026-06-10T00:00:00Z",
    transaction_date: "2026-06-10T00:00:00Z",
    description: "",
    amount: 0,
    ...over,
  } as FinanceTransaction;
}

describe("sortTransactions", () => {
  it("ordena valor por número mesmo se vier string, não por texto", () => {
    // listTransactions já coage Decimal-como-string na fronteira, então na
    // prática chega número. Este caso trava o comportamento defensivo: se a
    // coerção sumir, a comparação lexicográfica poria "900" acima de "1000"
    // — sem erro de tipo, só a ordem errada na tela.
    const rows = [
      txn({ id: "mil", amount: "1000.00000000" as unknown as number }),
      txn({ id: "novecentos", amount: "900.00000000" as unknown as number }),
      txn({ id: "dez-mil", amount: "10000.00000000" as unknown as number }),
    ];
    expect(sortTransactions(rows, "amount", "asc").map((t) => t.id)).toEqual([
      "novecentos", "mil", "dez-mil",
    ]);
    expect(sortTransactions(rows, "amount", "desc").map((t) => t.id)).toEqual([
      "dez-mil", "mil", "novecentos",
    ]);
  });

  it("ordena por vencimento", () => {
    const rows = [
      txn({ id: "junho", due_date: "2026-06-10T00:00:00Z" }),
      txn({ id: "abril", due_date: "2026-04-02T00:00:00Z" }),
      txn({ id: "maio", due_date: "2026-05-30T00:00:00Z" }),
    ];
    expect(sortTransactions(rows, "due_date", "asc").map((t) => t.id)).toEqual([
      "abril", "maio", "junho",
    ]);
  });

  it("Lançamento ordena por transaction_date, não por due_date", () => {
    // Regressão apontada em revisão: a coluna "Lançamento" exibe
    // transaction_date, mas o cabeçalho estava ligado a "due_date" — numa
    // linha com vencimento bem diferente do lançamento (recorrência,
    // parcela), a ordem "por Lançamento" na tela não batia com as datas
    // visíveis na própria coluna. As duas transações abaixo têm
    // transaction_date e due_date deliberadamente invertidos entre si, para
    // que ordenar pela chave errada dê o resultado oposto ao certo.
    const rows = [
      txn({ id: "lancada-cedo-vence-tarde", transaction_date: "2026-06-01T00:00:00Z", due_date: "2026-06-30T00:00:00Z" }),
      txn({ id: "lancada-tarde-vence-cedo", transaction_date: "2026-06-15T00:00:00Z", due_date: "2026-06-02T00:00:00Z" }),
    ];
    expect(sortTransactions(rows, "transaction_date", "asc").map((t) => t.id)).toEqual([
      "lancada-cedo-vence-tarde", "lancada-tarde-vence-cedo",
    ]);
    // Pela chave errada (due_date) a ordem sairia invertida — é exatamente o
    // bug: a coluna Lançamento pareceria fora de ordem.
    expect(sortTransactions(rows, "due_date", "asc").map((t) => t.id)).toEqual([
      "lancada-tarde-vence-cedo", "lancada-cedo-vence-tarde",
    ]);
  });

  it("ordena por descrição e trata descrição vazia", () => {
    const rows = [
      txn({ id: "b", description: "Boleto" }),
      txn({ id: "sem", description: null as unknown as string }),
      txn({ id: "a", description: "Aluguel" }),
    ];
    expect(sortTransactions(rows, "description", "asc").map((t) => t.id)).toEqual([
      "sem", "a", "b",
    ]);
  });

  it("não muta a lista recebida", () => {
    const rows = [txn({ id: "a", amount: 2 }), txn({ id: "b", amount: 1 })];
    sortTransactions(rows, "amount", "asc");
    expect(rows.map((t) => t.id)).toEqual(["a", "b"]);
  });
});
