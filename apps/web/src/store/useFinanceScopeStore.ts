import { create } from "zustand";

interface FinanceScopeStore {
  /** Conta selecionada como "carteira ativa" — todas as telas de Finanças
   * (resumo, gráficos, projeção, análises, transações, exportação) e a
   * Visão Geral (contas, mas não as carteiras de investimento) passam a
   * mostrar só os dados dela. null = visão consolidada. */
  activeAccountId: string | null;
  setActiveAccountId: (id: string | null) => void;
}

// Não persiste de propósito — como o modo de personalização do dashboard,
// "só a conta X" é um recorte momentâneo de análise, não uma preferência.
// Reabrir o app dias depois já filtrado numa única conta, sem lembrar por
// quê, seria mais confuso do que voltar sempre ao consolidado.
export const useFinanceScopeStore = create<FinanceScopeStore>()((set) => ({
  activeAccountId: null,
  setActiveAccountId: (id) => set({ activeAccountId: id }),
}));
