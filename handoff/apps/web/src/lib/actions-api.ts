import { apiClient } from "./api-client";

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

export async function getActionCenter(): Promise<ActionCenter> {
  const res = await apiClient.get<ActionCenter>("/actions");
  return res.data;
}
