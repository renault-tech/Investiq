import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listGeneratedReports,
  downloadGeneratedReport,
  deleteGeneratedReport,
  quickGenerateReport,
  type GeneratedReport,
  type QuickReportType,
} from "@/lib/generated-reports-api";

export function useGeneratedReports() {
  return useQuery({ queryKey: ["generated-reports"], queryFn: listGeneratedReports, staleTime: 10_000 });
}

export function useQuickGenerateReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ type, params, fileName }: { type: QuickReportType; params: Record<string, string | number | undefined>; fileName: string }) =>
      quickGenerateReport(type, params, fileName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generated-reports"] });
      toast.success("Relatório gerado.");
    },
    onError: () => toast.error("Falha ao gerar relatório."),
  });
}

export function useDownloadGeneratedReport() {
  return useMutation({
    mutationFn: (report: GeneratedReport) => downloadGeneratedReport(report),
    onError: () => toast.error("Falha ao baixar relatório."),
  });
}

export function useDeleteGeneratedReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteGeneratedReport(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generated-reports"] });
      toast.success("Relatório removido.");
    },
    onError: () => toast.error("Falha ao remover relatório."),
  });
}
