import { create } from "zustand";

type Theme = "dark" | "light";

interface UIStore {
  theme: Theme;
  fontScale: number;
  sidebarCollapsed: boolean;
  setTheme: (theme: Theme) => void;
  setFontScale: (scale: number, persist?: boolean) => void;
  toggleSidebar: () => void;
}

// Lazy import to avoid circular deps at module load time
async function persistFontScale(scale: number) {
  const { patchSettings } = await import("@/lib/settings-api");
  patchSettings({ font_size_scale: String(scale) }).catch(() => null);
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
  setFontScale: (scale, persist = true) => {
    const clamped = Math.min(1.5, Math.max(0.75, scale));
    set({ fontScale: clamped });
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty("--font-scale", String(clamped));
    }
    if (persist) persistFontScale(clamped);
  },
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}));
