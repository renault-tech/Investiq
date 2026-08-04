import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getSettings, patchSettings, updateApiKeys, SettingsPatch, ApiKeysUpdate } from "@/lib/settings-api";

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
    staleTime: 60_000,
  });
}

export function usePatchSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SettingsPatch) => patchSettings(input),
    onSuccess: (data) => {
      queryClient.setQueryData(["settings"], data);
      toast.success("Preferências salvas.");
    },
    onError: () => toast.error("Falha ao salvar preferências."),
  });
}

export function useUpdateApiKeys() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ApiKeysUpdate) => updateApiKeys(input),
    onSuccess: (data) => {
      queryClient.setQueryData(["settings"], data);
      toast.success("Chave salva com segurança.");
    },
    onError: () => toast.error("Falha ao salvar chave."),
  });
}
