import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listSessions, revokeSession, revokeOtherSessions } from "@/lib/sessions-api";

export function useSessions() {
  return useQuery({ queryKey: ["auth", "sessions"], queryFn: listSessions, staleTime: 30_000 });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => revokeSession(sessionId),
    onSuccess: () => {
      toast.success("Sessão encerrada.");
      queryClient.invalidateQueries({ queryKey: ["auth", "sessions"] });
    },
    onError: () => toast.error("Falha ao encerrar sessão."),
  });
}

export function useRevokeOtherSessions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => revokeOtherSessions(),
    onSuccess: ({ revoked_count }) => {
      toast.success(
        revoked_count > 0
          ? `${revoked_count} outra${revoked_count > 1 ? "s" : ""} sessão${revoked_count > 1 ? "ões" : ""} encerrada${revoked_count > 1 ? "s" : ""}.`
          : "Nenhuma outra sessão ativa."
      );
      queryClient.invalidateQueries({ queryKey: ["auth", "sessions"] });
    },
    onError: () => toast.error("Falha ao encerrar as outras sessões."),
  });
}
