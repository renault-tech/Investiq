import { useQuery } from "@tanstack/react-query";
import { listAnalyses, AnalysisListItem } from "@/lib/analysis-api";

export function useAnalyses(portfolioId: string | null) {
  return useQuery<AnalysisListItem[]>({
    queryKey: ["analyses", portfolioId],
    queryFn: () => listAnalyses(portfolioId!),
    enabled: Boolean(portfolioId),
  });
}
