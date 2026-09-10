import { useQuery } from "@tanstack/react-query";
import { getActionCenter } from "@/lib/actions-api";

export function useActionCenter() {
  return useQuery({
    queryKey: ["actions"],
    queryFn: getActionCenter,
    staleTime: 30_000,
  });
}
