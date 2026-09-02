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
      const parts: string[] = [];
      if (result.transactions_repaired > 0) {
        parts.push(`${result.transactions_repaired} transação(ões) recalculada(s) com o câmbio do dia do lançamento`);
      }
      if (result.snapshots_cleared > 0) {
        parts.push("o histórico do gráfico foi limpo e será recalculado");
      }
      toast.success(
        parts.length > 0
          ? `${parts.join("; ")}.`
          : "Nada a corrigir — câmbio e histórico já estavam certos."
      );
      // Toda leitura de posição muda junto com o custo recalculado.
      queryClient.invalidateQueries({ queryKey: ["portfolio-audit", portfolioId] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-summary", portfolioId] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-performance", portfolioId] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-benchmark", portfolioId] });
    },
    onError: () => toast.error("Falha ao corrigir o câmbio das transações."),
  });
}
