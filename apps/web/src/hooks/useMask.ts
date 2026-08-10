"use client";

import { useUIStore } from "@/store/useUIStore";

/** Máscara de valores do toggle de privacidade (o "olho" do cabeçalho).
 * Toda tela que mostra dinheiro precisa passar os valores por aqui — sem
 * isso o olho fica ligado mas a tela continua exibindo o saldo. */
export function useMask(): (text: string) => string {
  const privacy = useUIStore((s) => s.privacy);
  return (text: string) => (privacy ? "•••••••" : text);
}
