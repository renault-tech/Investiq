import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  listTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getFinanceSummary,
  TransactionFilters,
  CreateTransactionInput,
  FinanceCategory,
} from "@/lib/finance-api";

export function useCategories() {
  return useQuery({
    queryKey: ["finance", "categories"],
    queryFn: listCategories,
    staleTime: 5 * 60_000,
  });
}

export function useTransactions(filters: TransactionFilters) {
  return useQuery({
    queryKey: ["finance", "transactions", filters],
    queryFn: () => listTransactions(filters),
    staleTime: 30_000,
  });
}

export function useFinanceSummary(month: string) {
  return useQuery({
    queryKey: ["finance", "summary", month],
    queryFn: () => getFinanceSummary(month),
    staleTime: 30_000,
  });
}

function useInvalidateFinance() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["finance"] });
}

export function useCreateTransaction() {
  const invalidate = useInvalidateFinance();
  return useMutation({
    mutationFn: (input: CreateTransactionInput) => createTransaction(input),
    onSuccess: () => {
      toast.success("Transação registrada.");
      invalidate();
    },
    onError: () => toast.error("Falha ao registrar transação."),
  });
}

export function useUpdateTransaction() {
  const invalidate = useInvalidateFinance();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CreateTransactionInput> }) =>
      updateTransaction(id, input),
    onSuccess: () => {
      toast.success("Transação atualizada.");
      invalidate();
    },
    onError: () => toast.error("Falha ao atualizar transação."),
  });
}

export function useDeleteTransaction() {
  const invalidate = useInvalidateFinance();
  return useMutation({
    mutationFn: ({ id, scope }: { id: string; scope?: "one" | "future" | "all" }) =>
      deleteTransaction(id, scope ?? "one"),
    onSuccess: (_data, { scope }) => {
      toast.success(scope === "all" ? "Parcelamento excluído." : "Transação excluída.");
      invalidate();
    },
    onError: () => toast.error("Falha ao excluir transação."),
  });
}

export function useCreateCategory() {
  const invalidate = useInvalidateFinance();
  return useMutation({
    mutationFn: (input: { name: string; category_type: "income" | "expense"; color?: string }) =>
      createCategory(input),
    onSuccess: () => {
      toast.success("Categoria criada.");
      invalidate();
    },
    onError: () => toast.error("Falha ao criar categoria (nome duplicado?)."),
  });
}

export function useUpdateCategory() {
  const invalidate = useInvalidateFinance();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<FinanceCategory> }) =>
      updateCategory(id, input),
    onSuccess: invalidate,
    onError: () => toast.error("Falha ao atualizar categoria."),
  });
}

export function useDeleteCategory() {
  const invalidate = useInvalidateFinance();
  return useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => {
      toast.success("Categoria desativada.");
      invalidate();
    },
    onError: () => toast.error("Falha ao remover categoria."),
  });
}
