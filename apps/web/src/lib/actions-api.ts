import { apiClient } from "./api-client";
import { coerceNumbers, coerceNumbersInList } from "./coerce";

export type ActionKind = "bill_due" | "bill_overdue" | "invoice_review" | "invoice_uncategorized";

export interface ActionItem {
  id: string;
  kind: ActionKind;
  title: string;
  description: string;
  amount: number | null;
  due_date: string | null;
  href: string;
}

export interface ActionCenter {
  items: ActionItem[];
  total_amount: number;
}

/** Central de Ações — inbox agregado de pendências. Nada aqui é uma tabela:
 * o backend calcula sob demanda a partir de Finanças e Cartões, e já devolve
 * ordenado por urgência (ver actions/service.py).
 *
 * `amount` e `total_amount` são `Decimal` no Pydantic, o que significa que
 * chegam como **string** no JSON. O tipo acima diz `number`, então o `tsc`
 * não acusa nada e a quebra só apareceria em runtime — daí a coerção na
 * fronteira, como em market-api.ts, goals-api.ts e cards-api.ts. */
export async function getActionCenter(): Promise<ActionCenter> {
  const res = await apiClient.get<ActionCenter>("/actions");
  const data = coerceNumbers(res.data, ["total_amount"] as const);
  return { ...data, items: coerceNumbersInList(data.items ?? [], ["amount"] as const) };
}
