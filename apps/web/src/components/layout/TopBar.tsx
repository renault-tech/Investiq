"use client";

import { Moon, Sun, ZoomIn, ZoomOut, Bell, ChevronDown, Settings, LogOut } from "lucide-react";
import { useUIStore } from "@/store/useUIStore";
import { useUserStore } from "@/store/useUserStore";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePatchSettings } from "@/hooks/useSettings";
import { apiClient, clearAccessToken } from "@/lib/api-client";

export function TopBar() {
  const { fontScale, setFontScale } = useUIStore();
  const { theme, setTheme } = useTheme();
  const user = useUserStore((s) => s.user);
  const setUser = useUserStore((s) => s.setUser);
  const patchSettings = usePatchSettings();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleThemeToggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    patchSettings.mutate({ theme: next });
  }

  async function handleLogout() {
    try {
      await apiClient.post("/auth/logout");
    } catch {
      // ignore errors — clear state regardless
    }
    clearAccessToken();
    setUser(null);
    router.push("/login");
  }

  return (
    <header className="h-14 border-b border-[var(--border)] bg-[var(--surface)] flex items-center px-6 gap-6 flex-shrink-0 justify-between">
      <div className="flex items-center">
        <span className="text-[var(--navy)] dark:text-white font-semibold text-sm mr-4 md:hidden">
          InvestIQ
        </span>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-4">
        {/* Zoom controls */}
        <div className="hidden sm:flex items-center">
          <button
            onClick={() => setFontScale(fontScale - 0.05)}
            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Diminuir fonte"
          >
            <ZoomOut size={14} />
          </button>
          <span className="mx-1 text-[var(--text-muted)]">|</span>
          <button
            onClick={() => setFontScale(fontScale + 0.05)}
            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Aumentar fonte"
          >
            <ZoomIn size={14} />
          </button>
        </div>

        <div className="w-px h-5 bg-[var(--border)] hidden sm:block" />

        {/* Theme toggle */}
        {mounted && (
          <button
            onClick={handleThemeToggle}
            className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={theme === "dark" ? "Modo claro" : "Modo escuro"}
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        )}

        {/* Notifications */}
        <button className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Notificações (em breve)">
          <Bell size={16} />
        </button>

        {/* Avatar dropdown */}
        {user && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((o) => !o)}
              className="flex items-center gap-2 cursor-pointer pl-2 rounded-lg py-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-[var(--navy)] flex items-center justify-center text-xs font-medium text-white shadow-sm border border-[var(--border-strong)]">
                {(user.full_name ?? user.email).charAt(0).toUpperCase()}
              </div>
              <ChevronDown
                size={14}
                className={`text-[var(--text-muted)] hidden sm:block transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
              />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg z-50 py-1.5 overflow-hidden">
                {/* User info */}
                <div className="px-4 py-2.5 border-b border-[var(--border)]">
                  <p className="text-[12px] font-semibold text-[var(--text-primary)] truncate">
                    {user.full_name ?? "Usuário"}
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)] truncate">{user.email}</p>
                </div>

                {/* Actions */}
                <button
                  onClick={() => { setDropdownOpen(false); router.push("/settings"); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-[12px] text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <Settings size={14} className="text-[var(--text-muted)]" />
                  Configurações
                </button>

                <div className="my-1 border-t border-[var(--border)]" />

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-[12px] text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                >
                  <LogOut size={14} />
                  Sair
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
