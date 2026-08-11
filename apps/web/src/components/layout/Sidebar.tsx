"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  BarChart2,
  LineChart,
  CreditCard,
  ArrowLeftRight,
  Target,
  FileText,
  Smartphone,
  Settings,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  TrendingUp,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useUIStore } from "@/store/useUIStore";
import { useUserStore } from "@/store/useUserStore";

const NAV_ITEMS = [
  { href: "/overview", label: "Visão geral", icon: LayoutDashboard },
  { href: "/finances", label: "Finanças", icon: BarChart2 },
  { href: "/investments", label: "Investimentos", icon: LineChart },
  { href: "/trader", label: "Trader", icon: TrendingUp },
  { href: "/finances/cards", label: "Cartões", icon: CreditCard },
  { href: "/transactions", label: "Transações", icon: ArrowLeftRight },
  { href: "/goals", label: "Metas", icon: Target },
  { href: "/reports", label: "Relatórios", icon: FileText },
  { href: "/mobile-preview", label: "App mobile", icon: Smartphone },
];

export function Sidebar() {
  const pathname = usePathname();
  const activeHref = NAV_ITEMS
    .filter((item) => pathname.startsWith(item.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const { sidebarCollapsed, toggleSidebar } = useUIStore(
    useShallow((s) => ({ sidebarCollapsed: s.sidebarCollapsed, toggleSidebar: s.toggleSidebar }))
  );
  const user = useUserStore((s) => s.user);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <aside
      className={`hidden md:flex flex-shrink-0 bg-[var(--surface)] border-r border-[var(--border)] flex-col transition-all duration-200 sticky top-0 h-screen ${
        sidebarCollapsed ? "w-16 p-2" : "w-[246px] p-4"
      }`}
    >
      {/* Logo */}
      <div className={`flex items-center gap-[11px] px-2 pb-[22px] ${sidebarCollapsed ? "justify-center" : ""}`}>
        <div
          className="w-8 h-8 rounded-[10px] flex-shrink-0 flex items-center justify-center font-bold text-[15px]"
          style={{
            background: "linear-gradient(145deg,var(--accent),var(--accent-2))",
            color: "#06110D",
            boxShadow: "0 8px 20px -8px var(--glow)",
          }}
        >
          iQ
        </div>
        {!sidebarCollapsed && (
          <>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold tracking-[-.03em] text-[var(--text-primary)]">InvestIQ</div>
              <div className="text-[10.5px] text-[var(--text-muted)] tracking-[.08em] uppercase">Wealth OS</div>
            </div>
            <button
              onClick={toggleSidebar}
              title="Recolher menu"
              aria-label="Recolher menu"
              className="w-7 h-7 rounded-[9px] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors flex-shrink-0"
            >
              <PanelLeftClose size={15} />
            </button>
          </>
        )}
      </div>

      {sidebarCollapsed && (
        <button
          onClick={toggleSidebar}
          title="Expandir menu"
          aria-label="Expandir menu"
          className="w-full h-8 mb-2 rounded-[9px] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors"
        >
          <PanelLeftOpen size={15} />
        </button>
      )}

      {!sidebarCollapsed && (
        <div className="text-[10.5px] text-[var(--text-muted)] tracking-[.1em] uppercase px-[10px] pb-2">Painel</div>
      )}

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === activeHref;
          return (
            <Link
              key={href}
              href={href}
              title={sidebarCollapsed ? label : undefined}
              className={`flex items-center gap-[11px] px-2.5 py-[9px] rounded-[11px] text-[13.5px] text-left transition-colors ${
                active
                  ? "bg-[var(--surface-3)] text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-2)]"
              } ${sidebarCollapsed ? "justify-center" : ""}`}
            >
              <Icon size={17} strokeWidth={1.7} className="flex-shrink-0" />
              {!sidebarCollapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      {/* IQ Insight */}
      {!sidebarCollapsed && (
        <div className="border border-[var(--border)] bg-[var(--surface-2)] rounded-2xl p-3.5 mb-3">
          <div className="flex items-center gap-[7px] text-[11px] text-[var(--accent)] tracking-[.06em] uppercase mb-[7px]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse-dot" />
            IQ Insight
          </div>
          <div className="text-[12.5px] leading-[1.45] text-[var(--text-secondary)]">
            Acompanhe seus maiores gastos por categoria na tela de Finanças e receba sugestões conforme seus lançamentos.
          </div>
        </div>
      )}

      {/* User footer */}
      <div className={`flex items-center gap-2.5 p-2 rounded-[14px] ${sidebarCollapsed ? "justify-center" : ""}`}>
        {user && (
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
            style={{ background: "linear-gradient(140deg,var(--accent-2),var(--accent))", color: "#06110D" }}
          >
            {(user.full_name ?? user.email).charAt(0).toUpperCase()}
          </div>
        )}
        {!sidebarCollapsed && user && (
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-semibold truncate text-[var(--text-primary)]">
              {user.full_name ?? user.email}
            </div>
            <div className="text-[11px] text-[var(--text-muted)] capitalize">{user.plan}</div>
          </div>
        )}
        {!sidebarCollapsed && (
          <>
            <Link
              href="/settings"
              title="Configurações"
              className="w-7 h-7 rounded-[9px] border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors flex-shrink-0"
            >
              <Settings size={14} />
            </Link>
            {mounted && (
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                title="Alternar tema"
                className="w-7 h-7 rounded-[9px] border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors flex-shrink-0"
              >
                {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
              </button>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
