import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSettings, patchSettings, updateApiKeys, type SettingsPatch, type ApiKeysPatch } from "@/lib/settings-api";

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
    staleTime: 60_000,
  });
}

export function usePatchSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: patchSettings,
    onSuccess: (data) => qc.setQueryData(["settings"], data),
  });
}

export function useUpdateApiKeys() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateApiKeys,
    onSuccess: (data) => qc.setQueryData(["settings"], data),
  });
}
