import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listAccounts,
  createAccount,
  updateAccount,
  archiveAccount,
  type AccountInput,
} from "@/lib/accounts-api";

export function useAccounts() {
  return useQuery({ queryKey: ["finance", "accounts"], queryFn: listAccounts, staleTime: 30_000 });
}

/** Saldo é derivado das transações, então qualquer lançamento muda as contas —
 * invalida o prefixo inteiro de finanças, não só a lista de contas. */
function useInvalidateAccounts() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["finance"] });
}

export function useCreateAccount() {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: (input: AccountInput) => createAccount(input),
    onSuccess: () => {
      toast.success("Conta criada.");
      invalidate();
    },
    onError: (error: { response?: { status?: number } }) =>
      toast.error(
        error?.response?.status === 409
          ? "Já existe uma conta com esse nome."
          : "Falha ao criar conta."
      ),
  });
}

export function useUpdateAccount() {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<AccountInput> }) =>
      updateAccount(id, input),
    onSuccess: () => {
      toast.success("Conta atualizada.");
      invalidate();
    },
    onError: () => toast.error("Falha ao atualizar conta."),
  });
}

export function useArchiveAccount() {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: (id: string) => archiveAccount(id),
    onSuccess: () => {
      toast.success("Conta arquivada.");
      invalidate();
    },
    onError: () => toast.error("Falha ao arquivar conta."),
  });
}
