"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
  BookOpen,
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
  { href: "/ajuda", label: "Ajuda", icon: BookOpen },
];

export function Sidebar() {
  const pathname = usePathname();
  // Prefixo mais longo vence: sem isso /finances/cards acende "Finanças"
  // junto de "Cartões", já que ambos casam no startsWith.
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
      // transition-[width,padding], não transition-all: o que anima aqui é o
      // colapso do rail. Com `all`, a troca de tema também interpola
      // background e cor, e a sidebar inteira passa 200ms num cinza
      // intermediário que não é nem o claro nem o escuro.
      className="hidden md:flex flex-shrink-0 flex-col sticky top-0 h-screen transition-[width,padding] duration-200"
      style={{
        width: sidebarCollapsed ? 64 : 246,
        padding: sidebarCollapsed ? "22px 8px 20px" : "22px 14px 20px",
        borderRight: "1px solid var(--border)",
        background: "var(--surface)",
      }}
    >
      {/* Logo */}
      <div className={`flex items-center gap-[11px] px-1.5 mb-[22px] ${sidebarCollapsed ? "justify-center" : ""}`}>
        <div
          className="w-[34px] h-[34px] rounded-[11px] flex-shrink-0 flex items-center justify-center font-bold text-[14px]"
          style={{
            // Segundo ponto do gradiente derivado do próprio --accent (mistura
            // com preto), não um verde fixo: a cor de destaque é escolhida
            // pelo usuário em Configurações → Aparência, e um literal aqui
            // deixaria o logo verde para quem escolhesse rosa ou azul.
            background: "linear-gradient(145deg,var(--accent),color-mix(in srgb,var(--accent) 72%,#000))",
            color: "var(--on-accent)",
            letterSpacing: "-.04em",
            boxShadow: "0 6px 18px color-mix(in srgb,var(--accent) 25%,transparent)",
          }}
        >
          iQ
        </div>
        {!sidebarCollapsed && (
          <>
            <div className="min-w-0 flex-1">
              <div className="text-[14.5px] font-semibold tracking-[-.02em] leading-[1.1] text-[var(--text-primary)]">
                InvestIQ
              </div>
              <div className="text-[10.5px] text-[var(--text-muted)] tracking-[.1em] uppercase mt-0.5">Wealth OS</div>
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
        <div className="text-[10px] text-[var(--text-muted)] tracking-[.14em] uppercase px-2 pb-2">Painel</div>
      )}

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === activeHref;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              title={sidebarCollapsed ? label : undefined}
              className={`group flex items-center gap-2.5 px-2 py-[9px] rounded-[10px] text-[13.5px] transition-colors ${
                active ? "" : "hover:bg-[var(--surface-2)]"
              } ${sidebarCollapsed ? "justify-center" : ""}`}
              style={{
                background: active ? "var(--surface-2)" : "transparent",
                color: active ? "var(--text-primary)" : "var(--text-secondary)",
              }}
            >
              {/* Marcador quadrado do design: o contorno vira accent e ganha
                  halo quando ativo. O ícone dentro é sempre pintado — o
                  design de referência deixa o inativo transparente, o que
                  esvazia o rail recolhido (onde o rótulo não aparece) e
                  deixaria dez quadrados idênticos e indistinguíveis. */}
              <span
                className="flex-shrink-0 flex items-center justify-center rounded-[6px] transition-colors"
                style={{
                  width: sidebarCollapsed ? 28 : 22,
                  height: sidebarCollapsed ? 28 : 22,
                  background: active ? "var(--glow)" : "transparent",
                  boxShadow: `inset 0 0 0 1.5px ${active ? "var(--accent)" : "var(--border-strong)"}`,
                }}
              >
                <Icon
                  size={sidebarCollapsed ? 16 : 13}
                  strokeWidth={2}
                  style={{ color: active ? "var(--accent)" : "currentColor" }}
                />
              </span>
              {!sidebarCollapsed && <span className="flex-1 min-w-0 truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      {/* IQ Insight */}
      {!sidebarCollapsed && (
        <div
          className="rounded-[14px] p-[13px] mb-3"
          style={{
            border: "1px solid color-mix(in srgb,var(--accent-2) 22%,transparent)",
            background:
              "linear-gradient(165deg,color-mix(in srgb,var(--accent-2) 14%,transparent),color-mix(in srgb,var(--accent-2) 3%,transparent))",
          }}
        >
          <div className="flex items-center gap-[7px] mb-2">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse-dot" style={{ background: "var(--accent-2)" }} />
            <span className="text-[10.5px] tracking-[.12em] uppercase font-semibold" style={{ color: "var(--accent-2)" }}>
              IQ Insight
            </span>
          </div>
          <div className="text-[12.5px] leading-[1.5] text-[var(--text-secondary)]">
            Acompanhe seus maiores gastos por categoria na tela de Finanças e receba sugestões conforme seus
            lançamentos.
          </div>
        </div>
      )}

      {/* User footer */}
      <div
        className={`flex items-center gap-2.5 p-2 pt-3 border-t border-[var(--border)] ${
          sidebarCollapsed ? "justify-center" : ""
        }`}
      >
        {user && (
          <div
            className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-[11.5px] font-semibold flex-shrink-0"
            // Avatar neutro (o design tira o destaque daqui e o concentra no
            // logo), mas com tinta legível: o gradiente do pacote punha
            // --text-secondary sobre --text-muted, ~1.1:1 — a inicial sumia.
            style={{ background: "var(--surface-3)", color: "var(--text-primary)" }}
          >
            {(user.full_name ?? user.email).charAt(0).toUpperCase()}
          </div>
        )}
        {!sidebarCollapsed && user && (
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-medium truncate text-[var(--text-primary)]">
              {user.full_name ?? user.email}
            </div>
            <div className="text-[10.5px] text-[var(--text-muted)] capitalize">{user.plan}</div>
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
            {/* Único alternador de tema do app — não remover daqui sem pôr
                em outro lugar visível. */}
            {mounted && (
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                title="Alternar tema"
                aria-label="Alternar tema"
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
