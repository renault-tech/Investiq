import { apiClient } from "./api-client";

export type AccountType = "checking" | "savings" | "cash" | "investment" | "other";

export interface Account {
  id: string;
  name: string;
  account_type: AccountType;
  institution: string | null;
  /** Rótulo livre do titular ("Eu", "Minha mãe"). É o que permite administrar
   * a conta de outra pessoa: agrupa e filtra, não isola. */
  holder: string | null;
  opening_balance: number;
  /** Derivado no servidor a partir dos lançamentos até agora — nunca guardado. */
  balance: number;
  currency: string;
  color: string | null;
  icon: string | null;
  include_in_total: boolean;
  portfolio_id: string | null;
  is_active: boolean;
}

export interface AccountInput {
  name: string;
  account_type?: AccountType;
  institution?: string;
  holder?: string;
  opening_balance?: number;
  currency?: string;
  color?: string;
  icon?: string;
  include_in_total?: boolean;
  portfolio_id?: string;
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: "Conta corrente",
  savings: "Poupança",
  cash: "Dinheiro",
  investment: "Investimentos",
  other: "Outra",
};

export async function listAccounts(): Promise<Account[]> {
  const res = await apiClient.get<Account[]>("/finance/accounts");
  return res.data;
}

export async function createAccount(input: AccountInput): Promise<Account> {
  const res = await apiClient.post<Account>("/finance/accounts", input);
  return res.data;
}

export async function updateAccount(id: string, input: Partial<AccountInput>): Promise<Account> {
  const res = await apiClient.patch<Account>(`/finance/accounts/${id}`, input);
  return res.data;
}

/** Arquiva (is_active=false) — as transações históricas continuam apontando
 * para a conta, então apagar de verdade não é uma opção. */
export async function archiveAccount(id: string): Promise<void> {
  await apiClient.delete(`/finance/accounts/${id}`);
}
