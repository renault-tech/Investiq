"use client";

import { useEffect } from "react";
import { useUIStore } from "@/store/useUIStore";
import { useUserStore } from "@/store/useUserStore";
import { apiClient } from "@/lib/api-client";
import { TourProvider } from "@/components/tour/TourProvider";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";

interface PlatformShellProps {
  children: React.ReactNode;
}

export function PlatformShell({ children }: PlatformShellProps) {
  const fontScale = useUIStore((s) => s.fontScale);
  const user = useUserStore((s) => s.user);
  const setUser = useUserStore((s) => s.setUser);

  // useUserStore só é populado pelas telas de login/registro — um reload
  // completo (F5, link direto, aba nova) zera esse estado em memória mesmo
  // com a sessão continuando válida (refresh_token em cookie httpOnly), já
  // que nada mais busca /auth/me de novo. O resto da tela carrega normal
  // porque cada hook de dado já lida com o 401 inicial via refresh do
  // api-client, mas o nome/avatar do usuário na sidebar e em Configurações
  // ficava vazio até um logout+login manual. apiClient já redireciona pra
  // /login sozinho se a sessão realmente tiver expirado (ver interceptor de
  // resposta em api-client.ts), então não precisa de tratamento de erro
  // aqui além de não travar a tela.
  useEffect(() => {
    if (user) return;
    apiClient.get("/auth/me").then((res) => setUser(res.data)).catch(() => {});
  }, [user, setUser]);

  return (
    <TourProvider>
      <div className="flex h-screen overflow-hidden bg-[var(--background)] text-[var(--text-primary)]">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <TopBar />
          <main
            className="flex-1 overflow-y-auto md:mb-0 mb-16"
            style={{ zoom: fontScale }}
          >
            {children}
          </main>
        </div>
        <BottomNav />
      </div>
    </TourProvider>
  );
}
