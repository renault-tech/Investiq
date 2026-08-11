import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { DEFAULT_ACCENT_ID, getAccentOption } from "@/lib/accentPalette";

type Theme = "dark" | "light";
export type Period = "1M" | "6M" | "1A" | "Tudo";

interface UIStore {
  theme: Theme;
  fontScale: number;
  sidebarCollapsed: boolean;
  privacy: boolean;
  period: Period;
  customize: boolean;
  accentColorId: string;
  setTheme: (theme: Theme) => void;
  setFontScale: (scale: number) => void;
  toggleSidebar: () => void;
  togglePrivacy: () => void;
  setPeriod: (period: Period) => void;
  toggleCustomize: () => void;
  setAccentColor: (id: string) => void;
}

/** Aplica as duas variantes (claro/escuro) da cor escolhida — ou remove o
 * override e volta ao verde padrão do design system, se for a opção "green". */
function applyAccentColor(id: string) {
  if (typeof document === "undefined") return;
  const root = document.documentElement.style;
  if (id === DEFAULT_ACCENT_ID) {
    root.removeProperty("--accent-override-light");
    root.removeProperty("--accent-override-dark");
    return;
  }
  const option = getAccentOption(id);
  root.setProperty("--accent-override-light", option.light);
  root.setProperty("--accent-override-dark", option.dark);
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      theme: "dark",
      fontScale: 1.0,
      sidebarCollapsed: false,
      privacy: false,
      period: "6M",
      customize: false,
      accentColorId: DEFAULT_ACCENT_ID,
      setTheme: (theme) => {
        set({ theme });
        if (typeof document !== "undefined") {
          document.documentElement.classList.toggle("dark", theme === "dark");
        }
      },
      setFontScale: (scale) => {
        const clamped = Math.min(1.5, Math.max(0.75, scale));
        set({ fontScale: clamped });
        if (typeof document !== "undefined") {
          document.documentElement.style.setProperty("--font-scale", String(clamped));
        }
      },
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      togglePrivacy: () => set((s) => ({ privacy: !s.privacy })),
      setPeriod: (period) => set({ period }),
      toggleCustomize: () => set((s) => ({ customize: !s.customize })),
      setAccentColor: (id) => {
        set({ accentColorId: id });
        applyAccentColor(id);
      },
    }),
    {
      name: "investiq-ui",
      storage: createJSONStorage(() => localStorage),
      // `customize` fica de fora de propósito: é um modo de edição momentâneo
      // do dashboard, não uma preferência — voltar ao app dias depois já em
      // modo de edição seria desconcertante. O resto o usuário espera que
      // permaneça: esconder valores num monitor compartilhado não pode
      // desligar sozinho a cada F5.
      partialize: (s) => ({
        fontScale: s.fontScale,
        sidebarCollapsed: s.sidebarCollapsed,
        privacy: s.privacy,
        period: s.period,
        accentColorId: s.accentColorId,
      }),
      onRehydrateStorage: () => (state) => {
        if (state && typeof document !== "undefined") {
          document.documentElement.style.setProperty("--font-scale", String(state.fontScale));
          applyAccentColor(state.accentColorId);
        }
      },
    }
  )
);

/** Máscara de valores monetários quando o modo privacidade está ativo. */
export function maskValue(text: string, privacy: boolean): string {
  return privacy ? "•••••••" : text;
}
