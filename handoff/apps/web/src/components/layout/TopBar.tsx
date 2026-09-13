"use client";

import { Eye, Search, ChevronDown, LogOut, LayoutGrid, Check } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useUIStore, type Period } from "@/store/useUIStore";
import { useUserStore } from "@/store/useUserStore";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/lib/api-client";
import { useMarketQuotes } from "@/hooks/useMarketTicker"; // ver handoff/.../useMarketTicker.ts
import { NotificationsDropdown } from "./NotificationsDropdown";
import { FeedbackButton } from "@/components/feedback/FeedbackButton";

/** Layout do design de referência (breadcrumb fino em cima do título +
 * faixa de cotações ao vivo) — toda a lógica real preservada (mesmos
 * hooks, mesmo handleLogout/handleSearchSubmit, mesma lista PAGE_TITLES).
 * Único acréscimo: a faixa de ticker, que usa getMarketQuotes já existente
 * em lib/market-api.ts (ver hook novo em useMarketTicker.ts). */

const PERIODS: Period[] = ["1M", "6M", "1A", "Tudo"];

const PAGE_TITLES: { prefix: string; title: string; sub: string; crumb: string }[] = [
  { prefix: "/overview", title: "Visão geral", sub: "Seu patrimônio consolidado", crumb: "Painel" },
  { prefix: "/finances/cards", title: "Cartões de crédito", sub: "Faturas e limites dos seus cartões", crumb: "Finanças" },
  { prefix: "/finances", title: "Finanças pessoais", sub: "Fluxo de caixa, categorias e projeção de saldo", crumb: "Painel" },
  { prefix: "/investments", title: "Investimentos", sub: "Carteira consolidada", crumb: "Painel" },
  { prefix: "/trader", title: "Trader", sub: "Mercado ao vivo, watchlist e alertas", crumb: "Painel" },
  { prefix: "/transactions", title: "Transações", sub: "Todos os seus lançamentos", crumb: "Finanças" },
  { prefix: "/goals", title: "Metas e planejamento", sub: "Seus objetivos financeiros", crumb: "Painel" },
  { prefix: "/reports", title: "Relatórios", sub: "Exportação e histórico patrimonial", crumb: "Painel" },
  { prefix: "/mobile-preview", title: "App mobile", sub: "InvestIQ · telas principais", crumb: "Painel" },
  { prefix: "/analysis", title: "Análise", sub: "Análise técnica e fundamentalista", crumb: "Investimentos" },
  { prefix: "/settings", title: "Configurações", sub: "Sua conta e preferências", crumb: "Conta" },
  { prefix: "/ajuda", title: "Central de ajuda", sub: "Tutoriais e o que cada tela faz", crumb: "Conta" },
];

const TICKERS = ["^BVSP", "^GSPC", "^IXIC", "USDBRL=X"];

function TickerStrip() {
  const { data } = useMarketQuotes(TICKERS);
  const items = data ?? [];
  if (items.length === 0) return null;
  const row = items.map((q) => (
    <span key={q.ticker} className="text-[var(--text-muted)]">
      {q.ticker.replace("^BVSP", "IBOV").replace("^GSPC", "S&P 500").replace("^IXIC", "NASDAQ").replace("USDBRL=X", "USD/BRL")}{" "}
      <span className="text-[var(--text-primary)]">{q.price.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</span>{" "}
      {q.change_pct !== null && (
        <span style={{ color: q.change_pct >= 0 ? "var(--accent)" : "var(--danger)" }}>
          {q.change_pct >= 0 ? "+" : ""}{q.change_pct.toFixed(2)}%
        </span>
      )}
    </span>
  ));
  return (
    <div className="hidden lg:flex items-center h-[34px] border-b border-[var(--border)] overflow-hidden" style={{ background: "var(--surface-2)" }}>
      <div className="flex items-center gap-1.5 px-3.5 h-full border-r border-[var(--border)] flex-shrink-0">
        <span className="w-[5px] h-[5px] rounded-full animate-pulse-dot" style={{ background: "var(--accent)" }} />
        <span className="text-[10px] tracking-[.12em] uppercase font-semibold text-[var(--text-muted)]">Mercado</span>
      </div>
      <div className="flex-1 overflow-hidden h-full">
        <div className="flex gap-6 items-center h-full pl-4 whitespace-nowrap font-mono text-[11.5px]" style={{ width: "max-content" }}>
          {row}
        </div>
      </div>
    </div>
  );
}

export function TopBar() {
  const { privacy, togglePrivacy, period, setPeriod, customize, toggleCustomize } = useUIStore(
    useShallow((s) => ({
      privacy: s.privacy, togglePrivacy: s.togglePrivacy, period: s.period, setPeriod: s.setPeriod,
      customize: s.customize, toggleCustomize: s.toggleCustomize,
    }))
  );
  const user = useUserStore((s) => s.user);
  const setUser = useUserStore((s) => s.setUser);
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function handleLogout() {
    setMenuOpen(false);
    await logout();
    setUser(null);
    router.push("/login");
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ticker = search.trim().toUpperCase();
    if (!ticker) return;
    router.push(`/investments/${encodeURIComponent(ticker)}`);
    setSearch("");
  };

  const isCustomizable = pathname.startsWith("/overview") || pathname === "/finances" || pathname.startsWith("/finances?");
  const page = PAGE_TITLES.find((p) => pathname.startsWith(p.prefix)) ?? PAGE_TITLES[0];

  return (
    <div className="sticky top-0 z-20 flex-shrink-0">
      <TickerStrip />
      <header
        className="flex items-start gap-[18px] px-[30px] py-4 border-b border-[var(--border)] flex-wrap"
        style={{ background: "var(--surface)", backdropFilter: "blur(20px)" }}
      >
        <div className="flex-1 min-w-[220px]">
          <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] mb-1.5">
            <span>{page.crumb}</span><span>/</span><span className="text-[var(--text-secondary)]">{page.title}</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="m-0 text-[24px] font-semibold tracking-[-.026em] text-[var(--text-primary)]">{page.title}</h1>
          </div>
          <div className="text-[12.5px] text-[var(--text-secondary)] mt-0.5">{page.sub}</div>
        </div>

        <form onSubmit={handleSearchSubmit} className="hidden lg:flex flex-1 justify-center max-w-xs mt-1">
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={14} className="text-[var(--text-muted)]" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar ticker (ex: PETR4)"
              aria-label="Buscar ativo por ticker"
              className="block w-full pl-9 pr-3 py-1.5 rounded-[9px] text-[12.5px] bg-[var(--surface-2)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              style={{ border: "1px solid var(--border)" }}
            />
          </div>
        </form>

        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <div className="hidden sm:flex items-center gap-1.5 rounded-[10px] p-[3px]" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className="px-3 py-1.5 rounded-[8px] text-xs font-medium transition-colors"
                style={{ background: period === p ? "var(--surface-3)" : "transparent", color: period === p ? "var(--text-primary)" : "var(--text-secondary)" }}
              >
                {p}
              </button>
            ))}
          </div>

          <FeedbackButton />

          <button
            onClick={togglePrivacy}
            title={privacy ? "Mostrar valores" : "Ocultar valores"}
            aria-pressed={privacy}
            className="w-[32px] h-[32px] rounded-[9px] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors flex-shrink-0"
            style={{ border: "1px solid var(--border)", background: "var(--surface-2)" }}
          >
            <Eye size={15} />
          </button>

          {isCustomizable && (
            <button
              onClick={toggleCustomize}
              aria-label={customize ? "Concluir personalização" : "Personalizar cards"}
              title={customize ? "Concluir personalização" : "Personalizar cards"}
              className="flex items-center gap-1.5 px-2.5 h-[32px] rounded-[9px] text-[12px] font-medium transition-colors flex-shrink-0"
              style={{
                border: `1px solid ${customize ? "var(--accent)" : "var(--border)"}`,
                background: customize ? "var(--glow)" : "var(--surface-2)",
                color: customize ? "var(--accent)" : "var(--text-secondary)",
              }}
            >
              {customize ? <Check size={14} /> : <LayoutGrid size={14} />}
              <span className="hidden md:inline">{customize ? "Concluir" : "Personalizar"}</span>
            </button>
          )}

          <NotificationsDropdown />

          {user && (
            <div className="relative pl-1" ref={menuRef}>
              <button onClick={() => setMenuOpen((v) => !v)} className="flex items-center gap-1.5 flex-shrink-0" aria-label="Menu da conta" aria-expanded={menuOpen}>
                <div
                  className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-[11.5px] font-semibold"
                  style={{ background: "linear-gradient(140deg,var(--text-muted),var(--border-strong))", color: "var(--text-secondary)" }}
                >
                  {(user.full_name ?? user.email).charAt(0).toUpperCase()}
                </div>
                <ChevronDown size={13} className="text-[var(--text-muted)] hidden sm:block" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-[12px] shadow-lg z-50 py-1" style={{ background: "var(--surface)", border: "1px solid var(--border-strong)" }}>
                  <div className="px-3 py-2 border-b border-[var(--border)]">
                    <p className="text-xs font-medium text-[var(--text-primary)] truncate">{user.full_name ?? user.email}</p>
                    <p className="text-xs text-[var(--text-muted)] truncate">{user.email}</p>
                  </div>
                  <button onClick={() => { setMenuOpen(false); router.push("/settings"); }} className="w-full text-left px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition-colors">
                    Configurações
                  </button>
                  <button onClick={handleLogout} className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm hover:bg-[var(--surface-2)] transition-colors" style={{ color: "var(--danger)" }}>
                    <LogOut size={14} /> Sair
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>
    </div>
  );
}
