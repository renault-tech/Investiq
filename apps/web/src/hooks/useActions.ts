import { useQuery } from "@tanstack/react-query";
import { getActionCenter } from "@/lib/actions-api";

/** As mutações que mudam o que o inbox lista invalidam ["actions"] —
 * useInvalidateFinance() em useFinance.ts e as mutações de fatura em
 * useCards.ts. O staleTime aqui é só o piso para quem troca de tela. */
export function useActionCenter() {
  return useQuery({
    queryKey: ["actions"],
    queryFn: getActionCenter,
    staleTime: 30_000,
  });
}
