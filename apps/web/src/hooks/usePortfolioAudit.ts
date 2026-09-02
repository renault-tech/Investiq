"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getPortfolioAudit,
  repairPortfolioFx,
  type PortfolioAudit,
} from "@/lib/portfolio-api";

export function usePortfolioAudit(portfolioId: string | null) {
  return useQuery<PortfolioAudit>({
    queryKey: ["portfolio-audit", portfolioId],
    queryFn: () => getPortfolioAudit(portfolioId!),
    enabled: Boolean(portfolioId),
    staleTime: 60_000,
  });
}

export function useRepairPortfolioFx(portfolioId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => repairPortfolioFx(portfolioId!),
    onSuccess: (result) => {
      if (result.transactions_repaired === 0) {
        toast.success("Nada a corrigir — o câmbio das transações já está certo.");
      } else {
        toast.success(
          `${result.transactions_repaired} transação(ões) recalculada(s) com o câmbio do dia do lançamento.`
        );
      }
      // Toda leitura de posição muda junto com o custo recalculado.
      queryClient.invalidateQueries({ queryKey: ["portfolio-audit", portfolioId] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-summary", portfolioId] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-performance", portfolioId] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-benchmark", portfolioId] });
    },
    onError: () => toast.error("Falha ao corrigir o câmbio das transações."),
  });
}
