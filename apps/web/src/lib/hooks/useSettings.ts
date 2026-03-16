import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { MOCK_SETTINGS } from "@/lib/mock-data"
import type { UserSettings } from "@/types"

// In-memory store for mock mutations
let settingsStore: UserSettings = { ...MOCK_SETTINGS }

export const useSettings = () =>
  useQuery({ queryKey: ["settings"], queryFn: () => Promise.resolve(settingsStore) })

export const useSaveSettings = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: Partial<UserSettings>) => {
      settingsStore = { ...settingsStore, ...patch }
      return Promise.resolve(settingsStore)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  })
}
