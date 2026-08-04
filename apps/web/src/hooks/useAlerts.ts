import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listAlerts, createAlert, updateAlert, deleteAlert } from "@/lib/alerts-api";

export function useAlerts() {
  return useQuery({ queryKey: ["alerts"], queryFn: listAlerts, staleTime: 30_000 });
}

export function useCreateAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createAlert,
    onSuccess: () => {
      toast.success("Alerta criado.");
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
    onError: () => toast.error("Falha ao criar alerta."),
  });
}

export function useUpdateAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateAlert>[1] }) =>
      updateAlert(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alerts"] }),
    onError: () => toast.error("Falha ao atualizar alerta."),
  });
}

export function useDeleteAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAlert(id),
    onSuccess: () => {
      toast.success("Alerta removido.");
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
    onError: () => toast.error("Falha ao remover alerta."),
  });
}
