import { create } from "zustand";

type Theme = "dark" | "light";
export type Period = "1M" | "6M" | "1A" | "Tudo";

interface UIStore {
  theme: Theme;
  fontScale: number;
  sidebarCollapsed: boolean;
  privacy: boolean;
  period: Period;
  customize: boolean;
  setTheme: (theme: Theme) => void;
  setFontScale: (scale: number) => void;
  toggleSidebar: () => void;
  togglePrivacy: () => void;
  setPeriod: (period: Period) => void;
  toggleCustomize: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  theme: "dark",
  fontScale: 1.0,
  sidebarCollapsed: false,
  privacy: false,
  period: "6M",
  customize: false,
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
}));

/** Máscara de valores monetários quando o modo privacidade está ativo. */
export function maskValue(text: string, privacy: boolean): string {
  return privacy ? "•••••••" : text;
}
