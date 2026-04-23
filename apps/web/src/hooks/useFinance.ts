import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getFinanceSummary, listTransactions, listCategories,
  createTransaction, deleteTransaction,
  type TransactionCreateInput,
} from "@/lib/finance-api";

export function useFinanceSummary(year: number, month: number) {
  return useQuery({
    queryKey: ["finance-summary", year, month],
    queryFn: () => getFinanceSummary(year, month),
    staleTime: 30_000,
  });
}

export function useFinanceTransactions(year: number, month: number) {
  return useQuery({
    queryKey: ["finance-transactions", year, month],
    queryFn: () => listTransactions(year, month),
    staleTime: 30_000,
  });
}

export function useFinanceCategories() {
  return useQuery({
    queryKey: ["finance-categories"],
    queryFn: listCategories,
    staleTime: 300_000,
  });
}

export function useCreateTransaction(year: number, month: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TransactionCreateInput) => createTransaction(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-transactions", year, month] });
      qc.invalidateQueries({ queryKey: ["finance-summary", year, month] });
    },
  });
}

export function useDeleteTransaction(year: number, month: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteTransaction,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-transactions", year, month] });
      qc.invalidateQueries({ queryKey: ["finance-summary", year, month] });
    },
  });
}
