"use client";

import { Landmark } from "lucide-react";
import { useAccounts } from "@/hooks/useAccounts";
import { useFinanceScopeStore } from "@/store/useFinanceScopeStore";

/** Trocar a "carteira ativa" (conta única vs. consolidado) direto do topo.
 *
 * Antes só dava para trocar de conta rolando até a seção Contas — que,
 * com mais cards acima dela, ficava fora da primeira dobra. Fica no topo,
 * fixo, junto dos outros controles globais (período, privacidade), porque
 * a troca de conta é usada junto da leitura dos números lá em cima, não
 * depois de rolar a tela toda.
 */
export function AccountSwitcher() {
  const { data: accounts = [] } = useAccounts();
  const activeAccountId = useFinanceScopeStore((s) => s.activeAccountId);
  const setActiveAccountId = useFinanceScopeStore((s) => s.setActiveAccountId);

  if (accounts.length === 0) return null;

  return (
    <div className="hidden md:flex items-center gap-1.5 px-2.5 h-[34px] rounded-[11px] border border-[var(--border)] bg-[var(--surface-2)] flex-shrink-0">
      <Landmark size={13} className="text-[var(--text-muted)] flex-shrink-0" />
      <select
        value={activeAccountId ?? ""}
        onChange={(e) => setActiveAccountId(e.target.value || null)}
        aria-label="Trocar conta ativa"
        className="bg-transparent text-[12px] text-[var(--text-secondary)] outline-none max-w-[140px]"
      >
        <option value="">Consolidado</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
            {a.holder ? ` · ${a.holder}` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
