import { useQuery } from "@tanstack/react-query";
import { getActionCenter } from "@/lib/actions-api";

/** As mutações que mudam o que o inbox lista invalidam ["actions"] —
 * useInvalidateFinance() em useFinance.ts e as mutações de cartão/fatura em
 * useCards.ts. Isso cobre o que o usuário faz.
 *
 * O que o usuário NÃO faz é passar da meia-noite: o endpoint só devolve
 * contas vencendo em até 7 dias, e uma conta vira "vencida" só pela data
 * mudando. Com o TopBar montado o tempo todo durante a navegação, uma aba
 * deixada aberta ficaria mostrando o estado de ontem — e, sem o worker de
 * vencimento, não há mais nenhum outro caminho que avise. Daí o refetch
 * periódico, além do refetch ao focar a janela que o React Query já faz. */
export function useActionCenter() {
  return useQuery({
    queryKey: ["actions"],
    queryFn: getActionCenter,
    staleTime: 30_000,
    refetchInterval: 5 * 60_000,
  });
}
