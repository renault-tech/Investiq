"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listWatchlist, addToWatchlist, removeFromWatchlist } from "@/lib/watchlist-api";

function errorMessage(err: unknown, fallback: string): string {
  if (err != null && typeof err === "object" && "response" in err) {
    const detail = (err as { response?: { data?: { detail?: unknown } } }).response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (detail != null && typeof detail === "object" && "message" in detail) {
      return String((detail as { message?: unknown }).message ?? fallback);
    }
  }
  return fallback;
}

export function useWatchlist() {
  return useQuery({ queryKey: ["watchlist"], queryFn: listWatchlist, staleTime: 30_000 });
}

export function useAddToWatchlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addToWatchlist,
    onSuccess: (item) => {
      toast.success(`${item.ticker} adicionado à watchlist.`);
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    },
    onError: (err) => toast.error(errorMessage(err, "Falha ao adicionar à watchlist.")),
  });
}

export function useRemoveFromWatchlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: removeFromWatchlist,
    onSuccess: () => {
      toast.success("Removido da watchlist.");
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    },
    onError: (err) => toast.error(errorMessage(err, "Falha ao remover da watchlist.")),
  });
}
