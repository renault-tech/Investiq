import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listCards,
  createCard,
  updateCard,
  deleteCard,
  listInvoices,
  getInvoice,
  uploadInvoice,
  updateInvoiceItem,
  confirmInvoice,
  deleteInvoice,
  getInvoiceAnalytics,
  CardInput,
  InvoiceItem,
} from "@/lib/cards-api";

/** A Central de Ações lista faturas em revisão e os lançamentos sem
 * categoria dentro delas — subir, confirmar ou excluir uma fatura (ou o
 * cartão inteiro, que cascateia as faturas), e categorizar um item, mudam o
 * inbox. Sem isto o badge fica contando pendência que já foi resolvida. */
function useInvalidateActions() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["actions"] });
}

export function useCards() {
  return useQuery({ queryKey: ["cards"], queryFn: listCards, staleTime: 5 * 60_000 });
}

export function useInvoices(cardId: string | null) {
  return useQuery({
    queryKey: ["cards", cardId, "invoices"],
    queryFn: () => listInvoices(cardId as string),
    enabled: cardId !== null,
    staleTime: 30_000,
  });
}

export function useInvoiceDetail(invoiceId: string | null) {
  return useQuery({
    queryKey: ["cards", "invoice", invoiceId],
    queryFn: () => getInvoice(invoiceId as string),
    enabled: invoiceId !== null,
    staleTime: 10_000,
  });
}

export function useCreateCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CardInput) => createCard(input),
    onSuccess: () => {
      toast.success("Cartão cadastrado.");
      queryClient.invalidateQueries({ queryKey: ["cards"] });
    },
    onError: () => toast.error("Falha ao cadastrar cartão."),
  });
}

export function useUpdateCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CardInput> }) => updateCard(id, input),
    onSuccess: () => {
      toast.success("Cartão atualizado.");
      queryClient.invalidateQueries({ queryKey: ["cards"] });
    },
    onError: () => toast.error("Falha ao atualizar cartão."),
  });
}

export function useDeleteCard() {
  const queryClient = useQueryClient();
  const invalidateActions = useInvalidateActions();
  return useMutation({
    mutationFn: (id: string) => deleteCard(id),
    onSuccess: () => {
      toast.success("Cartão removido.");
      queryClient.invalidateQueries({ queryKey: ["cards"] });
      invalidateActions();
    },
    onError: () => toast.error("Falha ao remover cartão."),
  });
}

/** `detail` de um erro da API pode ser uma string (exceções nossas), um
 * {message} (mesmo formato) ou — num 422 de validação automática do FastAPI —
 * uma lista de objetos {loc, msg, type}. Passar esse objeto/array direto pro
 * toast.error faz o React tentar renderizá-lo como filho e quebra a página
 * inteira ("Objects are not valid as a React child"); sempre normaliza pra
 * string antes de exibir. */
function uploadErrorMessage(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object" && "message" in detail && typeof (detail as { message?: unknown }).message === "string") {
    return (detail as { message: string }).message;
  }
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0];
    if (first && typeof first === "object" && "msg" in first) return String((first as { msg: unknown }).msg);
  }
  return fallback;
}

export function useUploadInvoice(cardId: string | null) {
  const queryClient = useQueryClient();
  const invalidateActions = useInvalidateActions();
  return useMutation({
    mutationFn: ({ referenceMonth, file }: { referenceMonth: string; file: File }) =>
      uploadInvoice(cardId as string, referenceMonth, file),
    onSuccess: (invoice) => {
      queryClient.invalidateQueries({ queryKey: ["cards", cardId, "invoices"] });
      invalidateActions();
      if (invoice.status === "failed") {
        toast.error(invoice.error_message ?? "Falha ao processar a fatura.");
      } else {
        toast.success("Fatura processada — revise os lançamentos.");
      }
    },
    onError: (err: unknown) => {
      toast.error(uploadErrorMessage(err, "Falha no upload da fatura."));
    },
  });
}

export function useUpdateInvoiceItem(invoiceId: string | null) {
  const queryClient = useQueryClient();
  const invalidateActions = useInvalidateActions();
  return useMutation({
    mutationFn: ({ itemId, input }: { itemId: string; input: Partial<InvoiceItem> }) =>
      updateInvoiceItem(invoiceId as string, itemId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cards", "invoice", invoiceId] });
      invalidateActions();
    },
    onError: () => toast.error("Falha ao atualizar item."),
  });
}

export function useConfirmInvoice(cardId: string | null) {
  const queryClient = useQueryClient();
  const invalidateActions = useInvalidateActions();
  return useMutation({
    mutationFn: (invoiceId: string) => confirmInvoice(invoiceId),
    onSuccess: (_, invoiceId) => {
      toast.success("Fatura confirmada — transações lançadas em Finanças.");
      queryClient.invalidateQueries({ queryKey: ["cards", cardId, "invoices"] });
      queryClient.invalidateQueries({ queryKey: ["cards", "invoice", invoiceId] });
      queryClient.invalidateQueries({ queryKey: ["finance"] });
      invalidateActions();
    },
    onError: () => toast.error("Falha ao confirmar fatura."),
  });
}

export function useDeleteInvoice(cardId: string | null) {
  const queryClient = useQueryClient();
  const invalidateActions = useInvalidateActions();
  return useMutation({
    mutationFn: (invoiceId: string) => deleteInvoice(invoiceId),
    onSuccess: () => {
      toast.success("Fatura excluída.");
      queryClient.invalidateQueries({ queryKey: ["cards", cardId, "invoices"] });
      invalidateActions();
    },
    onError: () => toast.error("Falha ao excluir fatura."),
  });
}

export function useInvoiceAnalytics(invoiceId: string | null) {
  return useQuery({
    queryKey: ["cards", "invoice", invoiceId, "analytics"],
    queryFn: () => getInvoiceAnalytics(invoiceId as string),
    enabled: invoiceId !== null,
    staleTime: 30_000,
  });
}
