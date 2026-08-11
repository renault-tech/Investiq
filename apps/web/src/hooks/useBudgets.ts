import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listBudgets, upsertBudget, deleteBudget } from "@/lib/budgets-api";
import { useFinanceScopeStore } from "@/store/useFinanceScopeStore";

/** Orçamentos da carteira ativa — ou os consolidados, quando nenhuma está
 * selecionada. O escopo entra na queryKey, senão trocar de carteira serviria
 * o cache da anterior. */
export function useBudgets() {
  const accountId = useFinanceScopeStore((s) => s.activeAccountId);
  return useQuery({
    queryKey: ["finance", "budgets", accountId],
    queryFn: () => listBudgets(accountId),
    staleTime: 30_000,
  });
}

export function useUpsertBudget() {
  const queryClient = useQueryClient();
  const accountId = useFinanceScopeStore((s) => s.activeAccountId);
  return useMutation({
    mutationFn: ({ categoryId, amount }: { categoryId: string; amount: number }) =>
      upsertBudget(categoryId, amount, accountId),
    onSuccess: () => {
      toast.success("Orçamento salvo.");
      queryClient.invalidateQueries({ queryKey: ["finance", "budgets"] });
    },
    onError: () => toast.error("Falha ao salvar orçamento."),
  });
}

export function useDeleteBudget() {
  const queryClient = useQueryClient();
  const accountId = useFinanceScopeStore((s) => s.activeAccountId);
  return useMutation({
    mutationFn: (categoryId: string) => deleteBudget(categoryId, accountId),
    onSuccess: () => {
      toast.success("Orçamento removido.");
      queryClient.invalidateQueries({ queryKey: ["finance", "budgets"] });
    },
    onError: () => toast.error("Falha ao remover orçamento."),
  });
}
