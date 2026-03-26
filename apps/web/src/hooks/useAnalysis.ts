import { useQuery } from "@tanstack/react-query";
import { getAnalysis, AnalysisDetail } from "@/lib/analysis-api";

export function useAnalysis(analysisId: string | null) {
  return useQuery<AnalysisDetail>({
    queryKey: ["analysis", analysisId],
    queryFn: () => getAnalysis(analysisId!),
    enabled: Boolean(analysisId),
  });
}
