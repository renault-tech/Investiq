import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  uploadStatement,
  getImportBatch,
  updateImportRow,
  confirmImportBatch,
  discardImportBatch,
  type ImportRowUpdateInput,
} from "@/lib/import-api";

/** A API devolve {code, message} em erros — extrai a mensagem em pt-BR para
 * o toast em vez de deixar o objeto vazar como texto. */
function errorMessage(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: { message?: string } } } })?.response
    ?.data?.detail;
  return detail?.message ?? fallback;
}

export function useImportBatch(batchId: string | null) {
  return useQuery({
    queryKey: ["finance", "import", batchId],
    queryFn: () => getImportBatch(batchId as string),
    enabled: batchId !== null,
  });
}

export function useUploadStatement() {
  return useMutation({
    mutationFn: ({ file, bankAccountId }: { file: File; bankAccountId?: string }) =>
      uploadStatement(file, bankAccountId),
    onError: (err) => toast.error(errorMessage(err, "Falha ao enviar o extrato.")),
  });
}

export function useUpdateImportRow(batchId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ rowId, input }: { rowId: string; input: ImportRowUpdateInput }) =>
      updateImportRow(rowId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance", "import", batchId] });
    },
    onError: () => toast.error("Falha ao atualizar a linha."),
  });
}

export function useConfirmImportBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (batchId: string) => confirmImportBatch(batchId),
    onSuccess: (result) => {
      toast.success(
        result.skipped > 0
          ? `${result.created} transações importadas (${result.skipped} não selecionadas).`
          : `${result.created} transações importadas.`
      );
      queryClient.invalidateQueries({ queryKey: ["finance"] });
    },
    onError: (err) => toast.error(errorMessage(err, "Falha ao confirmar a importação.")),
  });
}

export function useDiscardImportBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (batchId: string) => discardImportBatch(batchId),
    onSuccess: () => {
      toast.success("Importação descartada.");
      queryClient.invalidateQueries({ queryKey: ["finance", "import"] });
    },
    onError: () => toast.error("Falha ao descartar a importação."),
  });
}
