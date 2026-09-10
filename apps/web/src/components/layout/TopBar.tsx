"use client";

import { Eye, Search, ChevronDown, LogOut, LayoutGrid, Check } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useUIStore, type Period } from "@/store/useUIStore";
import { useUserStore } from "@/store/useUserStore";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/lib/api-client";
import { useMarketQuotes } from "@/hooks/useAssetData";
import { NotificationsDropdown } from "./NotificationsDropdown";
import { FeedbackButton } from "@/components/feedback/FeedbackButton";
import { formatDecimal, formatPercent } from "@/lib/number-format";

const PERIODS: Period[] = ["1M", "6M", "1A", "Tudo"];

// `crumb` é a trilha fina acima do título (o nível em que a tela vive), não
// um caminho navegável — Cartões e Transações vivem sob Finanças mesmo com
// rotas em raízes diferentes.
// A ordem importa: a busca é por prefixo e para no primeiro que casa, então
// /finances/cards precisa vir ANTES de /finances.
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

const TICKER_LABELS: Record<string, string> = {
  "^BVSP": "IBOV",
  "^GSPC": "S&P 500",
  "^IXIC": "NASDAQ",
  "USDBRL=X": "USD/BRL",
};
const TICKERS = Object.keys(TICKER_LABELS);

/** A faixa só existe a partir de `lg`. Esconder por CSS não basta: o
 * componente continuaria montado e a query rebuscaria cotações de minuto em
 * minuto, em toda tela, para quem nem vê a faixa. Aqui ela nem monta. */
function useIsWideScreen() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return wide;
}

/** Faixa de cotações ao vivo, sobre o `useMarketQuotes` que já existe em
 * hooks/useAssetData.ts — nenhuma API nova.
 *
 * A queryKey daquele hook é a lista inteira de tickers, então caches só são
 * compartilhados entre chamadas com EXATAMENTE a mesma lista: estes 4 são um
 * subconjunto dos 9 do MarketOverviewStrip, mas isso não os faz reaproveitar
 * nada. Daí a faixa não ser montada no Trader (ver `showTicker`) — senão as
 * duas consultas conviveriam ali, cada uma repetindo de minuto em minuto. */
function TickerStrip() {
  const { data } = useMarketQuotes(TICKERS);
  const items = data ?? [];
  if (items.length === 0) return null;

  return (
    <div
      className="hidden lg:flex items-center h-[34px] border-b border-[var(--border)] overflow-hidden"
      style={{ background: "var(--surface-2)" }}
    >
      <div className="flex items-center gap-1.5 px-3.5 h-full border-r border-[var(--border)] flex-shrink-0">
        <span className="w-[5px] h-[5px] rounded-full animate-pulse-dot" style={{ background: "var(--accent)" }} />
        <span className="text-[10px] tracking-[.12em] uppercase font-semibold text-[var(--text-muted)]">Mercado</span>
      </div>
      <div className="flex-1 overflow-hidden h-full">
        <div className="flex gap-6 items-center h-full pl-4 whitespace-nowrap font-mono text-[11.5px]">
          {items.map((q) => (
            <span key={q.ticker} className="text-[var(--text-muted)]">
              {TICKER_LABELS[q.ticker] ?? q.ticker}{" "}
              <span className="text-[var(--text-primary)]">{formatDecimal(q.price)}</span>{" "}
              {q.change_pct !== null && (
                <span style={{ color: q.change_pct >= 0 ? "var(--accent)" : "var(--danger)" }}>
                  {formatPercent(q.change_pct, 2, { signed: true })}
                </span>
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

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
  const wide = useIsWideScreen();

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

  // Telas com cards ajustáveis (arrastar/redimensionar/ocultar) — o botão
  // de personalizar só faz sentido onde há um painel pra organizar.
  const isCustomizable =
    pathname.startsWith("/overview") || pathname === "/finances" || pathname.startsWith("/finances?");
  const page = PAGE_TITLES.find((p) => pathname.startsWith(p.prefix)) ?? PAGE_TITLES[0];

  // No Trader a faixa fica de fora: o MarketOverviewStrip da própria tela já
  // mostra estes 4 instrumentos (e mais 5), num formato bem melhor. Além da
  // redundância visual, as duas consultas têm queryKeys diferentes — a faixa
  // aqui abriria um segundo ciclo de busca das mesmas cotações, a cada minuto.
  const showTicker = wide && !pathname.startsWith("/trader");

  return (
    <div className="sticky top-0 z-20 flex-shrink-0">
      {showTicker && <TickerStrip />}
      <header
        className="flex items-start gap-[18px] px-[30px] py-4 border-b border-[var(--border)] flex-wrap"
        style={{ background: "var(--surface)", backdropFilter: "blur(20px)" }}
      >
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] mb-1.5">
            <span>{page.crumb}</span>
            <span aria-hidden="true">/</span>
            <span className="text-[var(--text-secondary)]">{page.title}</span>
          </div>
          {/* Deliberadamente um div, não um h1: várias telas dentro do
              shell (Configurações, Planejamento, Ajuda, Análise) já têm o
              próprio h1, e um segundo aqui daria dois títulos de nível 1
              na mesma página para quem navega por cabeçalhos. */}
          <div className="text-[22px] font-semibold tracking-[-.026em] text-[var(--text-primary)]">
            {page.title}
          </div>
          <div className="text-[12.5px] text-[var(--text-secondary)] mt-0.5">{page.sub}</div>
        </div>

        {/* Global ticker search */}
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
              className="block w-full pl-9 pr-3 h-[34px] border border-[var(--border)] rounded-[10px] text-[12.5px] bg-[var(--surface-2)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>
        </form>

        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {/* Period pills */}
          <div
            data-tour="topbar-period"
            className="hidden sm:flex items-center gap-1.5 bg-[var(--surface-2)] border border-[var(--border)] rounded-[10px] p-[3px]"
          >
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className="px-3 py-1.5 rounded-[8px] text-xs font-medium transition-colors"
                style={{
                  background: period === p ? "var(--surface-3)" : "transparent",
                  color: period === p ? "var(--text-primary)" : "var(--text-secondary)",
                }}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Feedback — discreto, mas presente em toda tela: o relato vale
              justamente por sair de onde o problema apareceu. */}
          <FeedbackButton />

          {/* Privacy toggle */}
          <button
            data-tour="topbar-privacy"
            onClick={togglePrivacy}
            title={privacy ? "Mostrar valores" : "Ocultar valores"}
            aria-pressed={privacy}
            className="w-[34px] h-[34px] rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors flex-shrink-0"
          >
            <Eye size={15} />
          </button>

          {/* Customize (painéis ajustáveis) — só o rótulo some no mobile (sem
              espaço pro texto ao lado de busca e período); o botão em si fica
              sempre visível, senão quem usa o celular não tem como descobrir
              que dá pra redimensionar/mover/ocultar os cards. */}
          {isCustomizable && (
            <button
              onClick={toggleCustomize}
              aria-label={customize ? "Concluir personalização" : "Personalizar cards"}
              title={customize ? "Concluir personalização" : "Personalizar cards"}
              className="flex items-center gap-1.5 px-2.5 md:px-3 h-[34px] rounded-[10px] text-[12.5px] font-medium transition-colors flex-shrink-0"
              style={{
                border: `1px solid ${customize ? "var(--accent)" : "var(--border)"}`,
                background: customize ? "var(--glow)" : "var(--surface-2)",
                color: customize ? "var(--accent)" : "var(--text-secondary)",
              }}
            >
              {customize ? <Check size={15} /> : <LayoutGrid size={15} />}
              <span className="hidden md:inline">{customize ? "Concluir" : "Personalizar"}</span>
            </button>
          )}

          <NotificationsDropdown />

          {/* Avatar/Perfil */}
          {user && (
            <div className="relative pl-1" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-1.5 cursor-pointer flex-shrink-0"
                aria-label="Menu da conta"
                aria-expanded={menuOpen}
              >
                <div
                  className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-[11.5px] font-semibold"
                  style={{ background: "var(--surface-3)", color: "var(--text-primary)" }}
                >
                  {(user.full_name ?? user.email).charAt(0).toUpperCase()}
                </div>
                <ChevronDown size={13} className="text-[var(--text-muted)] hidden sm:block" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-[var(--surface)] border border-[var(--border-strong)] rounded-[12px] shadow-lg z-50 py-1">
                  <div className="px-3 py-2 border-b border-[var(--border)]">
                    <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                      {user.full_name ?? user.email}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] truncate">{user.email}</p>
                  </div>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      router.push("/settings");
                    }}
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
        </div>
      </header>
    </div>
  );
}
