"use client";

import { Moon, Sun, ZoomIn, ZoomOut } from "lucide-react";
import { useUIStore } from "@/store/useUIStore";

export function TopBar() {
  const { theme, setTheme, fontScale, setFontScale } = useUIStore();

  return (
    <header className="h-14 border-b border-neutral-800 bg-neutral-900 flex items-center justify-end gap-2 px-4 flex-shrink-0">
      {/* Zoom controls */}
      <button
        onClick={() => setFontScale(fontScale - 0.05)}
        className="p-1.5 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300 transition-colors"
        title="Decrease font size"
        aria-label="Decrease font size"
      >
        <ZoomOut size={15} />
      </button>
      <span className="text-xs text-neutral-600 w-9 text-center tabular-nums">
        {Math.round(fontScale * 100)}%
      </span>
      <button
        onClick={() => setFontScale(fontScale + 0.05)}
        className="p-1.5 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300 transition-colors"
        title="Increase font size"
        aria-label="Increase font size"
      >
        <ZoomIn size={15} />
      </button>

      <div className="w-px h-5 bg-neutral-800 mx-1" />

      {/* Theme toggle */}
      <button
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className="p-1.5 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300 transition-colors"
        title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        aria-label="Toggle theme"
      >
        {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
      </button>
    </header>
  );
}
