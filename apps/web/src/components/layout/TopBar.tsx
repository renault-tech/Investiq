"use client";

import { Eye, EyeOff, Search, ChevronDown, LogOut, LayoutGrid, Check, HelpCircle, Plus, Settings } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useShallow } from "zustand/react/shallow";
import { useUIStore, type Period } from "@/store/useUIStore";
import { useUserStore } from "@/store/useUserStore";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/lib/api-client";
import { useMarketQuotes } from "@/hooks/useAssetData";
import { MARKET_INSTRUMENTS, formatInstrumentValue } from "@/lib/market-instruments";
import { NotificationsDropdown } from "./NotificationsDropdown";
import { ActionCenterDropdown } from "./ActionCenterDropdown";
import { OPEN_COMMAND_PALETTE_EVENT } from "./CommandPalette";
import { TransactionModal } from "@/components/finances/TransactionModal";
import { useCategories } from "@/hooks/useFinance";
import { FeedbackButton } from "@/components/feedback/FeedbackButton";
import { formatPercent } from "@/lib/number-format";

const PERIODS: Period[] = ["1M", "6M", "1A", "Tudo"];

// `crumb` é a trilha fina acima do título (o nível em que a tela vive), não
// um caminho navegável — Cartões e Transações vivem sob Finanças mesmo com
// rotas em raízes diferentes.
// A ordem importa: a busca é por prefixo e para no primeiro que casa, então
// /finances/cards precisa vir ANTES de /finances.
const PAGE_TITLES: { prefix: string; title: string; sub: string; crumb: string }[] = [
  { prefix: "/overview", title: "Visão geral", sub: "Seu patrimônio consolidado", crumb: "Patrimônio" },
  { prefix: "/finances/cards", title: "Cartões de crédito", sub: "Faturas e limites dos seus cartões", crumb: "Finanças" },
  { prefix: "/finances", title: "Finanças pessoais", sub: "Fluxo de caixa, categorias e projeção de saldo", crumb: "Painel" },
  { prefix: "/investments", title: "Investimentos", sub: "Carteira consolidada", crumb: "Painel" },
  { prefix: "/trader", title: "Trader", sub: "Mercado ao vivo, watchlist e alertas", crumb: "Painel" },
  { prefix: "/transactions", title: "Transações", sub: "Todos os seus lançamentos", crumb: "Finanças" },
  { prefix: "/goals", title: "Metas e planejamento", sub: "Seus objetivos financeiros", crumb: "Painel" },
  { prefix: "/taxes", title: "Impostos & IR", sub: "Apuração de ganho de capital, DARF e informe de rendimentos", crumb: "Painel" },
  { prefix: "/reports", title: "Relatórios", sub: "Exportação e histórico patrimonial", crumb: "Painel" },
  { prefix: "/mobile-preview", title: "App mobile", sub: "InvestIQ · telas principais", crumb: "Painel" },
  { prefix: "/analysis", title: "Análise", sub: "Análise técnica e fundamentalista", crumb: "Investimentos" },
  { prefix: "/settings", title: "Configurações", sub: "Sua conta e preferências", crumb: "Conta" },
  { prefix: "/ajuda", title: "Central de ajuda", sub: "Tutoriais e o que cada tela faz", crumb: "Conta" },
];

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

/** Painel de checkboxes pra escolher quais instrumentos aparecem na faixa —
 * a lista inteira vem de lib/market-instruments.ts, a mesma do Trader. */
function TickerSettingsPanel({ selected, onChange, onClose }: { selected: string[]; onChange: (t: string[]) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [onClose]);

  const toggle = (ticker: string) => {
    onChange(selected.includes(ticker) ? selected.filter((t) => t !== ticker) : selected.concat(ticker));
  };

  return (
    <div
      ref={ref}
      className="absolute top-full right-2 mt-1.5 w-56 bg-[var(--surface)] border border-[var(--border-strong)] rounded-[12px] shadow-lg z-50 p-2"
    >
      <div className="text-[10.5px] tracking-[.08em] uppercase text-[var(--text-muted)] px-2 py-1.5">
        Cotações na faixa
      </div>
      {MARKET_INSTRUMENTS.map((inst) => (
        <label
          key={inst.ticker}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12.5px] text-[var(--text-secondary)] hover:bg-[var(--surface-2)] cursor-pointer"
        >
          <input
            type="checkbox"
            checked={selected.includes(inst.ticker)}
            onChange={() => toggle(inst.ticker)}
            className="accent-[var(--accent)]"
          />
          {inst.label}
        </label>
      ))}
    </div>
  );
}

/** Faixa de cotações ao vivo, sobre o `useMarketQuotes` que já existe em
 * hooks/useAssetData.ts (atualiza a cada 60s) — nenhuma API nova.
 *
 * Rola em looping contínuo (CSS puro, `animate-ticker-scroll`): a lista
 * inteira é renderizada duas vezes seguidas e desliza metade da própria
 * largura, então quando a primeira cópia sai da tela a segunda já está
 * exatamente no lugar da primeira — o corte fica invisível.
 *
 * A queryKey do hook é a lista inteira de tickers, então caches só são
 * compartilhados entre chamadas com EXATAMENTE a mesma lista — daí a faixa
 * não ser montada no Trader (ver `showTicker`), que já tem seu próprio
 * `MarketOverviewStrip` com todos os 9 instrumentos; as duas conviveriam ali,
 * cada uma com sua própria busca a cada minuto. */
function TickerStrip() {
  const tickerInstruments = useUIStore((s) => s.tickerInstruments);
  const setTickerInstruments = useUIStore((s) => s.setTickerInstruments);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const selected = MARKET_INSTRUMENTS.filter((i) => tickerInstruments.includes(i.ticker));
  const tickers = selected.map((i) => i.ticker);
  const { data } = useMarketQuotes(tickers);
  const byTicker = new Map((data ?? []).map((q) => [q.ticker, q]));

  if (selected.length === 0) {
    return (
      <div className="hidden lg:flex items-center h-[42px] px-3.5 border-b border-[var(--border)] text-[11.5px] text-[var(--text-muted)]" style={{ background: "var(--surface-2)" }}>
        Nenhuma cotação selecionada.
        <button onClick={() => setSettingsOpen(true)} className="ml-2 font-medium" style={{ color: "var(--accent)" }}>
          Escolher cotações
        </button>
      </div>
    );
  }

  const renderItem = (inst: (typeof MARKET_INSTRUMENTS)[number], key: string) => {
    const q = byTicker.get(inst.ticker);
    const positive = (q?.change_pct ?? 0) >= 0;
    return (
      <span key={key} className="flex items-center gap-2 whitespace-nowrap">
        <span className="text-[11px] text-[var(--text-muted)] tracking-[.04em] uppercase">{inst.label}</span>
        <span className="font-mono text-[14px] font-medium text-[var(--text-primary)]">
          {q ? formatInstrumentValue(q.price, inst.kind) : "—"}
        </span>
        {q?.change_pct != null && (
          <span className="font-mono text-[12px]" style={{ color: positive ? "var(--accent)" : "var(--danger)" }}>
            {formatPercent(q.change_pct, 2, { signed: true })}
          </span>
        )}
      </span>
    );
  };

  return (
    <div
      className="hidden lg:flex items-center h-[42px] border-b border-[var(--border)] relative"
      style={{ background: "var(--surface-2)" }}
    >
      <div className="flex items-center gap-1.5 px-4 h-full border-r border-[var(--border)] flex-shrink-0">
        <span className="w-[6px] h-[6px] rounded-full animate-pulse-dot" style={{ background: "var(--accent)" }} />
        <span className="text-[10.5px] tracking-[.12em] uppercase font-semibold text-[var(--text-muted)]">Mercado</span>
      </div>
      <div className="flex-1 overflow-hidden h-full">
        <div className="flex items-center h-full animate-ticker-scroll" style={{ width: "max-content" }}>
          <div className="flex items-center gap-8 pl-6 pr-6">{selected.map((inst) => renderItem(inst, `a-${inst.ticker}`))}</div>
          <div aria-hidden="true" className="flex items-center gap-8 pr-6">{selected.map((inst) => renderItem(inst, `b-${inst.ticker}`))}</div>
        </div>
      </div>
      <button
        onClick={() => setSettingsOpen((v) => !v)}
        aria-label="Personalizar cotações"
        title="Personalizar cotações"
        className="flex items-center justify-center w-[34px] h-full border-l border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex-shrink-0"
      >
        <Settings size={14} />
      </button>
      {settingsOpen && (
        <TickerSettingsPanel selected={tickerInstruments} onChange={setTickerInstruments} onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}

/** Componente separado para que `useCategories` só rode quando o modal abre —
 *  montado direto no TopBar, a query iria atrás das categorias em toda tela
 *  do app, inclusive nas que não têm nada a ver com finanças. */
function NewTransactionModal({ onClose }: { onClose: () => void }) {
  const { data: categories = [] } = useCategories();
  return <TransactionModal categories={categories} onClose={onClose} />;
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
  const [showNewTxn, setShowNewTxn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const wide = useIsWideScreen();
  const queryClient = useQueryClient();

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
    // router.push é navegação client-side: o QueryClient da raiz sobrevive
    // à troca de tela. Sem limpar, quem logasse em seguida na mesma aba
    // leria do cache do usuário anterior enquanto os dados ainda estivessem
    // frescos — vale para ["actions"], mas igualmente para ["finance"],
    // ["cards"], ["notifications"] e o resto. (Pelo 401 não acontece: ali o
    // redirect é window.location, que recarrega a página e destrói o cache.)
    queryClient.clear();
    router.push("/login");
  }

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

          {/* Privacy toggle — rotulado, como no design: um olho sozinho não
              dizia se estava escondendo ou mostrando valores. */}
          <button
            data-tour="topbar-privacy"
            onClick={togglePrivacy}
            title={privacy ? "Mostrar valores" : "Ocultar valores"}
            aria-pressed={privacy}
            className="flex items-center gap-1.5 h-[34px] px-2.5 rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)] text-[12.5px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors flex-shrink-0"
          >
            {privacy ? <EyeOff size={15} /> : <Eye size={15} />}
            <span className="hidden md:inline">{privacy ? "Mostrar" : "Ocultar"}</span>
          </button>

          {/* Busca global: pill compacta que abre a paleta ⌘K, em vez do
              campo largo de ticker — a paleta já busca telas e ativos. */}
          <button
            onClick={() => window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE_EVENT))}
            aria-label="Buscar (Ctrl+K)"
            className="hidden sm:flex items-center gap-2 h-[34px] pl-2.5 pr-2 rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)] text-[12.5px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors flex-shrink-0"
          >
            <Search size={14} />
            <span className="hidden lg:inline">Buscar...</span>
            <kbd className="font-mono text-[10.5px] px-1.5 py-0.5 rounded-md border border-[var(--border)] bg-[var(--surface-3)] text-[var(--text-secondary)]">
              ⌘K
            </kbd>
          </button>

          {/* Feedback — discreto, mas presente em toda tela: o relato vale
              justamente por sair de onde o problema apareceu. */}
          <FeedbackButton />

          {/* Ajuda */}
          <button
            onClick={() => router.push("/ajuda")}
            aria-label="Central de ajuda"
            title="Central de ajuda"
            className="w-[34px] h-[34px] rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors flex-shrink-0"
          >
            <HelpCircle size={15} />
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

          {/* Inbox e sino lado a lado, e sem repetição: pendência de
              vencimento vive só na Central de Ações, evento que já
              aconteceu vive só no sino. */}
          <ActionCenterDropdown />

          <NotificationsDropdown />

          {/* CTA primária do design — cria o lançamento de qualquer tela, em
              vez de obrigar a passar por Transações antes. */}
          <button
            onClick={() => setShowNewTxn(true)}
            className="flex items-center gap-1.5 h-[34px] px-3 rounded-[10px] text-[12.5px] font-semibold flex-shrink-0"
            style={{ background: "var(--accent)", color: "var(--on-accent)" }}
          >
            <Plus size={15} />
            <span className="hidden md:inline">Nova transação</span>
          </button>

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

      {showNewTxn && <NewTransactionModal onClose={() => setShowNewTxn(false)} />}
    </div>
  );
}
