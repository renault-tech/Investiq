import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { updateProfile, changePassword } from "@/lib/auth-api";
import { useUserStore } from "@/store/useUserStore";

export function useUpdateProfile() {
  const setUser = useUserStore((s) => s.setUser);
  return useMutation({
    mutationFn: (fullName: string) => updateProfile(fullName),
    onSuccess: (user) => {
      setUser(user);
      toast.success("Perfil atualizado.");
    },
    onError: () => toast.error("Falha ao atualizar o perfil."),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
      changePassword(currentPassword, newPassword),
    onSuccess: () => toast.success("Senha alterada."),
    onError: (err: unknown) => {
      const status = (err as { response?: { status?: number } })?.response?.status;
      toast.error(status === 401 ? "Senha atual incorreta." : "Falha ao alterar a senha.");
    },
  });
}
