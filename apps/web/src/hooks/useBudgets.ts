import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listBudgets, upsertBudget, deleteBudget } from "@/lib/budgets-api";

export function useBudgets() {
  return useQuery({ queryKey: ["finance", "budgets"], queryFn: listBudgets, staleTime: 30_000 });
}

export function useUpsertBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ categoryId, amount }: { categoryId: string; amount: number }) =>
      upsertBudget(categoryId, amount),
    onSuccess: () => {
      toast.success("Orçamento salvo.");
      queryClient.invalidateQueries({ queryKey: ["finance", "budgets"] });
    },
    onError: () => toast.error("Falha ao salvar orçamento."),
  });
}

export function useDeleteBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (categoryId: string) => deleteBudget(categoryId),
    onSuccess: () => {
      toast.success("Orçamento removido.");
      queryClient.invalidateQueries({ queryKey: ["finance", "budgets"] });
    },
    onError: () => toast.error("Falha ao remover orçamento."),
  });
}
