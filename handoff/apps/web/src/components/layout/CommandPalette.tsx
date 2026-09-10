"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  BookOpen, LayoutDashboard, BarChart2, LineChart, CreditCard, ArrowLeftRight,
  Target, FileText, Smartphone, Settings, TrendingUp, Sun, Moon, Search,
} from "lucide-react";

// Mesma lista de Sidebar.tsx (NAV_ITEMS) — duplicada de propósito: mover pra
// um módulo compartilhado exigiria tocar Sidebar.tsx também, e o objetivo
// aqui é o menor diff possível para revisar. Se divergir da Sidebar depois,
// unificar num só lib/nav-items.ts.
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

/** ⌘K / Ctrl+K global. Sem endpoint de busca de ticker por nome hoje (só
 * cotação por ticker já conhecido em market-api.ts) — "Ativos" aqui é indo
 * direto para /investments/{TICKER} quando o texto parece um ticker (2-6
 * letras/números maiúsculos), não uma busca por nome de empresa. Expandir
 * pra busca por nome exige endpoint novo no backend, fora deste escopo. */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        setQuery("");
        setSelected(0);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const quickActions = useMemo(
    () => [
      {
        label: theme === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro",
        icon: theme === "dark" ? Sun : Moon,
        run: () => setTheme(theme === "dark" ? "light" : "dark"),
      },
      { label: "Configurações", icon: Settings, run: () => router.push("/settings") },
    ],
    [theme, setTheme, router]
  );

  const q = query.trim().toLowerCase();
  const navResults = NAV_ITEMS.filter((n) => !q || n.label.toLowerCase().includes(q));
  const actionResults = quickActions.filter((a) => !q || a.label.toLowerCase().includes(q));
  const tickerMatch = /^[A-Z0-9]{2,8}$/.test(query.trim().toUpperCase()) && query.trim().length >= 2;
  const assetResults = tickerMatch
    ? [{ label: `Ir para ${query.trim().toUpperCase()}`, ticker: query.trim().toUpperCase() }]
    : [];

  type Flat = { run: () => void };
  const flat: Flat[] = [
    ...navResults.map((n) => ({ run: () => router.push(n.href) })),
    ...assetResults.map((a) => ({ run: () => router.push(`/investments/${a.ticker}`) })),
    ...actionResults.map((a) => ({ run: a.run })),
  ];

  function close() {
    setOpen(false);
  }
  function runSelected() {
    flat[selected]?.run();
    close();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-24" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/50" onClick={close} />
      <div className="relative w-full max-w-[560px] mx-4 bg-[var(--surface)] border border-[var(--border-strong)] rounded-2xl shadow-[var(--shadow)] overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[var(--border)]">
          <Search size={15} className="text-[var(--text-muted)] flex-shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelected((s) => Math.min(s + 1, Math.max(flat.length - 1, 0)));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelected((s) => Math.max(s - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                runSelected();
              }
            }}
            placeholder="Buscar telas, ticker (ex: PETR4), ações rápidas…"
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none"
          />
          <kbd className="text-[10px] text-[var(--text-muted)] border border-[var(--border)] rounded px-1.5 py-0.5">Esc</kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {navResults.length > 0 && (
            <ResultGroup label="Telas">
              {navResults.map((n, i) => (
                <ResultRow key={n.href} icon={n.icon} label={n.label} active={i === selected} onClick={() => { router.push(n.href); close(); }} />
              ))}
            </ResultGroup>
          )}
          {assetResults.length > 0 && (
            <ResultGroup label="Ativos">
              {assetResults.map((a, i) => (
                <ResultRow key={a.ticker} icon={TrendingUp} label={a.label} active={navResults.length + i === selected} onClick={() => { router.push(`/investments/${a.ticker}`); close(); }} />
              ))}
            </ResultGroup>
          )}
          {actionResults.length > 0 && (
            <ResultGroup label="Ações rápidas">
              {actionResults.map((a, i) => (
                <ResultRow key={a.label} icon={a.icon} label={a.label} active={navResults.length + assetResults.length + i === selected} onClick={() => { a.run(); close(); }} />
              ))}
            </ResultGroup>
          )}
          {flat.length === 0 && (
            <p className="text-center text-[12.5px] text-[var(--text-muted)] py-8">Nada encontrado.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] px-2.5 py-1.5">{label}</div>
      {children}
    </div>
  );
}

function ResultRow({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[10px] text-[13px] text-left transition-colors"
      style={{ background: active ? "var(--surface-2)" : "transparent", color: "var(--text-primary)" }}
    >
      <Icon size={15} />
      {label}
    </button>
  );
}

// Integração em PlatformShell.tsx: importar CommandPalette e renderizar uma
// vez dentro do <TourProvider>, ao lado de <Sidebar />/<BottomNav />:
//
//   <TourProvider>
//     <CommandPalette />
//     <div className="flex h-screen overflow-hidden ...">
//       ...
//
// E no botão de busca existente em TopBar.tsx (linha ~102, "Buscar ticker"),
// trocar o onFocus/onClick para abrir a palette em vez do campo de ticker
// atual, ou manter os dois se quiser preservar a busca de ticker inline.
