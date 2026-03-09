import { create } from "zustand";

type Theme = "dark" | "light";

interface UIStore {
  theme: Theme;
  fontScale: number;
  sidebarCollapsed: boolean;
  setTheme: (theme: Theme) => void;
  setFontScale: (scale: number) => void;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  theme: "dark",
  fontScale: 1.0,
  sidebarCollapsed: false,
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
}));
