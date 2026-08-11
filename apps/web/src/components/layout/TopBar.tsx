"use client";

import { Eye, Search, ChevronDown, LogOut, LayoutGrid, Check } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useUIStore, type Period } from "@/store/useUIStore";
import { useUserStore } from "@/store/useUserStore";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/lib/api-client";
import { NotificationsDropdown } from "./NotificationsDropdown";

const PERIODS: Period[] = ["1M", "6M", "1A", "Tudo"];

const PAGE_TITLES: { prefix: string; title: string; sub: string }[] = [
  { prefix: "/overview", title: "Visão geral", sub: "Seu patrimônio consolidado" },
  { prefix: "/finances/cards", title: "Cartões de crédito", sub: "Faturas e limites dos seus cartões" },
  { prefix: "/finances", title: "Finanças pessoais", sub: "Fluxo de caixa, categorias e projeção de saldo" },
  { prefix: "/investments", title: "Investimentos", sub: "Carteira consolidada" },
  { prefix: "/trader", title: "Trader", sub: "Mercado ao vivo, watchlist e alertas" },
  { prefix: "/transactions", title: "Transações", sub: "Todos os seus lançamentos" },
  { prefix: "/goals", title: "Metas e planejamento", sub: "Seus objetivos financeiros" },
  { prefix: "/reports", title: "Relatórios", sub: "Exportação e histórico patrimonial" },
  { prefix: "/mobile-preview", title: "App mobile", sub: "InvestIQ · telas principais" },
  { prefix: "/analysis", title: "Análise", sub: "Análise técnica e fundamentalista" },
  { prefix: "/settings", title: "Configurações", sub: "Sua conta e preferências" },
];

export function TopBar() {
  const { privacy, togglePrivacy, period, setPeriod, customize, toggleCustomize } = useUIStore(
    useShallow((s) => ({
      privacy: s.privacy,
      togglePrivacy: s.togglePrivacy,
      period: s.period,
      setPeriod: s.setPeriod,
      customize: s.customize,
      toggleCustomize: s.toggleCustomize,
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
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
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

  const isOverview = pathname.startsWith("/overview");
  const page = PAGE_TITLES.find((p) => pathname.startsWith(p.prefix)) ?? PAGE_TITLES[0];

  return (
    <header
      className="sticky top-0 z-20 flex items-center gap-[18px] px-[30px] py-4 border-b border-[var(--border)] flex-shrink-0"
      style={{ background: "var(--surface)", backdropFilter: "blur(20px)" }}
    >
      <div className="flex-1 min-w-[180px]">
        <div className="text-[19px] font-semibold tracking-[-.035em] whitespace-nowrap text-[var(--text-primary)]">
          {page.title}
        </div>
        <div className="text-[12.5px] text-[var(--text-secondary)] mt-0.5">{page.sub}</div>
      </div>

      {/* Global ticker search */}
      <form onSubmit={handleSearchSubmit} className="hidden lg:flex flex-1 justify-center max-w-xs">
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
            className="block w-full pl-9 pr-3 py-1.5 border border-[var(--border)] rounded-[11px] text-[12.5px] bg-[var(--surface-2)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
        </div>
      </form>

      {/* Period pills */}
      <div className="hidden sm:flex items-center gap-1.5 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-[3px]">
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className="px-3 py-1.5 rounded-[9px] text-xs font-medium transition-colors"
            style={{
              background: period === p ? "var(--surface-3)" : "transparent",
              color: period === p ? "var(--text-primary)" : "var(--text-secondary)",
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Privacy toggle */}
      <button
        onClick={togglePrivacy}
        title={privacy ? "Mostrar valores" : "Ocultar valores"}
        aria-pressed={privacy}
        className="w-[34px] h-[34px] rounded-[11px] border border-[var(--border)] bg-[var(--surface-2)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors flex-shrink-0"
      >
        <Eye size={16} />
      </button>

      {/* Customize (Visão geral only) */}
      {isOverview && (
        <button
          onClick={toggleCustomize}
          className="hidden md:flex items-center gap-2 px-3.5 h-[34px] rounded-[11px] text-[12.5px] font-medium transition-colors flex-shrink-0"
          style={{
            border: `1px solid ${customize ? "var(--accent)" : "var(--border)"}`,
            background: customize ? "var(--glow)" : "var(--surface-2)",
            color: customize ? "var(--accent)" : "var(--text-secondary)",
          }}
        >
          {customize ? <Check size={15} /> : <LayoutGrid size={15} />}
          {customize ? "Concluir" : "Personalizar"}
        </button>
      )}

      <NotificationsDropdown />

      {/* Avatar/Perfil */}
      {user && (
        <div className="relative pl-1" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 cursor-pointer flex-shrink-0"
            aria-label="Menu da conta"
            aria-expanded={menuOpen}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium"
              style={{ background: "linear-gradient(140deg,var(--accent-2),var(--accent))", color: "#06110D" }}
            >
              {(user.full_name ?? user.email).charAt(0).toUpperCase()}
            </div>
            <ChevronDown size={14} className="text-[var(--text-muted)] hidden sm:block" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg z-50 py-1">
              <div className="px-3 py-2 border-b border-[var(--border)]">
                <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                  {user.full_name ?? user.email}
                </p>
                <p className="text-xs text-[var(--text-muted)] truncate">{user.email}</p>
              </div>
              <button
                onClick={() => { setMenuOpen(false); router.push("/settings"); }}
                className="w-full text-left px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition-colors"
              >
                Configurações
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm text-[var(--danger)] hover:bg-[var(--surface-2)] transition-colors"
              >
                <LogOut size={14} /> Sair
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
