"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listPositionTransactions,
  updatePosition,
  deletePosition,
  updateTransaction,
  deleteTransaction,
  type UpdatePositionInput,
  type UpdateTransactionInput,
} from "@/lib/portfolio-api";

function errorDetail(err: unknown, fallback: string): string {
  const detail =
    err != null &&
    typeof err === "object" &&
    "response" in err &&
    (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
  return typeof detail === "string" ? detail : fallback;
}

export function usePositionTransactions(positionId: string | null) {
  return useQuery({
    queryKey: ["position-transactions", positionId],
    queryFn: () => listPositionTransactions(positionId!),
    enabled: Boolean(positionId),
  });
}

/** Invalida tudo que deriva de posições/transações — resumo, look-through e
 * o próprio histórico — depois de qualquer edição, exclusão ou nova
 * transação, já que quantidade e preço médio são sempre recalculados. */
function useInvalidatePortfolio(portfolioId: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["portfolio-summary", portfolioId] });
    queryClient.invalidateQueries({ queryKey: ["portfolio-look-through", portfolioId] });
    queryClient.invalidateQueries({ queryKey: ["position-transactions"] });
  };
}

export function useUpdatePosition(portfolioId: string) {
  const invalidate = useInvalidatePortfolio(portfolioId);
  return useMutation({
    mutationFn: ({ positionId, input }: { positionId: string; input: UpdatePositionInput }) =>
      updatePosition(positionId, input),
    onSuccess: () => {
      toast.success("Ativo atualizado.");
      invalidate();
    },
    onError: (err) => toast.error(errorDetail(err, "Falha ao atualizar o ativo.")),
  });
}

export function useDeletePosition(portfolioId: string) {
  const invalidate = useInvalidatePortfolio(portfolioId);
  return useMutation({
    mutationFn: (positionId: string) => deletePosition(positionId),
    onSuccess: () => {
      toast.success("Ativo removido da carteira.");
      invalidate();
    },
    onError: (err) => toast.error(errorDetail(err, "Falha ao remover o ativo.")),
  });
}

export function useUpdateTransaction(portfolioId: string) {
  const invalidate = useInvalidatePortfolio(portfolioId);
  return useMutation({
    mutationFn: ({ transactionId, input }: { transactionId: string; input: UpdateTransactionInput }) =>
      updateTransaction(transactionId, input),
    onSuccess: () => {
      toast.success("Transação corrigida.");
      invalidate();
    },
    onError: (err) => toast.error(errorDetail(err, "Falha ao editar a transação.")),
  });
}

export function useDeleteTransaction(portfolioId: string) {
  const invalidate = useInvalidatePortfolio(portfolioId);
  return useMutation({
    mutationFn: (transactionId: string) => deleteTransaction(transactionId),
    onSuccess: () => {
      toast.success("Transação apagada.");
      invalidate();
    },
    onError: (err) => toast.error(errorDetail(err, "Falha ao apagar a transação.")),
  });
}
