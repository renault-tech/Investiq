"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { useEffect, useRef } from "react";
import { ThemeProvider } from "next-themes";

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClientRef = useRef<QueryClient | null>(null);
  if (!queryClientRef.current) {
    queryClientRef.current = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 20_000,
          retry: 1,
        },
      },
    });
  }

  // O build de produção (next build, Turbopack) não gera mais um service
  // worker novo — mas quem visitou uma versão mais antiga desta app pode ter
  // um já instalado no navegador, rodando pra sempre até algo o desregistrar.
  // Esse SW antigo trata TODA chamada à API como "cross-origin" (o frontend
  // e a API são dois projetos Vercel em domínios diferentes) e cacheia a
  // resposta por até 1h com um timeout de rede de só 10s — um cold start do
  // backend Python passa disso fácil, e o SW serve do cache uma resposta
  // antiga (às vezes um 401 de uma renovação de token em andamento) em vez
  // da resposta de verdade, derrubando a sessão sem o token ter expirado de
  // verdade. Sem SW nenhum registrado (o caso normal hoje), isto é um no-op.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => registration.unregister());
    });
    if (typeof caches !== "undefined") {
      caches.keys().then((keys) => {
        keys.forEach((key) => caches.delete(key));
      });
    }
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="dark">
      <QueryClientProvider client={queryClientRef.current}>
        {children}
        <Toaster position="top-right" theme="dark" richColors />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
