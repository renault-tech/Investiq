"use client";

import { Moon, Sun, ZoomIn, ZoomOut, Search, Bell, ChevronDown } from "lucide-react";
import { useUIStore } from "@/store/useUIStore";
import { useUserStore } from "@/store/useUserStore";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function TopBar() {
  const { fontScale, setFontScale } = useUIStore();
  const { theme, setTheme } = useTheme();
  const user = useUserStore((s) => s.user);
  
  // Prevent hydration mismatch for theme toggle
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <header className="h-14 border-b border-[var(--border)] bg-[var(--surface)] flex items-center px-6 gap-6 flex-shrink-0 justify-between">
      {/* Brand (Mobile only or when sidebar collapsed actually it's easier to keep it visible depending on design but spec says: Logo/marca esquerda) */}
      <div className="flex items-center">
        <span className="text-[var(--navy)] dark:text-white font-semibold text-sm mr-4 md:hidden">
          InvestIQ
        </span>
      </div>

      {/* Global Search */}
      <div className="flex-1 flex justify-center max-w-md w-full">
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={16} className="text-[var(--text-muted)]" />
          </div>
          <input
            type="text"
            placeholder="Buscar ativos, portfólios..."
            className="block w-full pl-10 pr-3 py-1.5 border border-[var(--border)] rounded-lg text-sm bg-[var(--background)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--navy)]"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Zoom controls */}
        <div className="flex items-center hidden sm:flex">
          <button
            onClick={() => setFontScale(fontScale - 0.05)}
            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Decrease font size"
            aria-label="Decrease font size"
          >
            <ZoomOut size={14} />
          </button>
          <span className="mx-1 text-[var(--text-muted)]">|</span>
          <button
            onClick={() => setFontScale(fontScale + 0.05)}
            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Increase font size"
            aria-label="Increase font size"
          >
            <ZoomIn size={14} />
          </button>
        </div>

        <div className="w-px h-5 bg-[var(--border)] hidden sm:block" />

        {/* Theme toggle */}
        {mounted && (
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        )}

        {/* Notifications */}
        <button className="relative p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <Bell size={16} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-[var(--danger)] rounded-full border border-[var(--surface)]"></span>
        </button>

        {/* Avatar/Perfil */}
        {user && (
          <div className="flex items-center gap-2 cursor-pointer pl-2">
            <div className="w-8 h-8 rounded-full bg-[var(--navy)] flex items-center justify-center text-xs font-medium text-white shadow-sm border border-[var(--border-strong)]">
              {(user.full_name ?? user.email).charAt(0).toUpperCase()}
            </div>
            <ChevronDown size={14} className="text-[var(--text-muted)] hidden sm:block" />
          </div>
        )}
      </div>
    </header>
  );
}
