"use client";

import { useQuery } from "@tanstack/react-query";
import { listPortfolios, type Portfolio } from "@/lib/portfolio-api";
import { usePortfolioSummary } from "@/hooks/usePortfolioSummary";
import { useAccounts } from "@/hooks/useAccounts";
import { useCards } from "@/hooks/useCards";
import { useTransactions } from "@/hooks/useFinance";
import { formatBRLCompact, formatBRLExact } from "@/components/charts/chartTheme";
import { AreaLineChart } from "@/components/charts/AreaLineChart";
import { usePortfolioPerformance } from "@/hooks/usePortfolioPerformance";

function PhoneFrame({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <div
      className="w-[330px] h-[690px] rounded-[46px] border border-[var(--border-strong)] bg-[var(--surface)] p-3 shadow-[var(--shadow)] relative animate-rise-up"
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="absolute top-[22px] left-1/2 -translate-x-1/2 w-24 h-[26px] rounded-2xl bg-[var(--background)] z-10" />
      <div className="h-full rounded-[36px] bg-[var(--background)] overflow-hidden pt-14 px-4.5 pb-4.5">
        {children}
      </div>
    </div>
  );
}

export function MobilePreviewClient() {
  const { data: portfolios = [] } = useQuery<Portfolio[]>({ queryKey: ["portfolios"], queryFn: listPortfolios, staleTime: 30_000 });
  const portfolioId = portfolios.find((p) => p.is_default)?.id ?? portfolios[0]?.id ?? null;
  const { data: summary } = usePortfolioSummary(portfolioId);
  const { data: performance = [] } = usePortfolioPerformance(portfolioId, "6m");
  const { data: accounts = [] } = useAccounts();
  const { data: cards = [] } = useCards();
  const { data: txPage } = useTransactions({ per_page: 4, page: 1 });

  const liquid = accounts.filter((a) => a.include_in_total).reduce((sum, a) => sum + Number(a.balance), 0);
  const invested = Number(summary?.total_market_value_brl ?? 0);
  const netWorth = liquid + invested;
  const perfValues = performance.map((p) => Number(p.total_value));
  const positions = (summary?.positions ?? []).slice(0, 5);
  const activeCard = cards.find((c) => c.is_active);

  return (
    <div className="p-[26px_30px_60px] min-w-[1180px]">
      <p className="text-[12.5px] text-[var(--text-secondary)] mb-5 max-w-xl">
        Referência visual das telas principais do app mobile — usa os mesmos dados reais da sua conta, sem funcionalidade própria de app nativo.
      </p>
      <div className="flex gap-8 flex-wrap justify-center">
        {/* Home */}
        <PhoneFrame delay={0}>
          <div className="text-xs text-[var(--text-secondary)]">Bom dia, Rafael</div>
          <div className="text-[11.5px] text-[var(--text-muted)] mt-3.5 tracking-[.06em] uppercase">Patrimônio</div>
          <div className="text-3xl font-semibold tracking-[-.045em] mt-1 text-[var(--text-primary)]">{formatBRLExact(netWorth)}</div>
          {perfValues.length >= 2 && <AreaLineChart values={perfValues} height={90} className="mt-3.5" />}
          <div className="flex gap-2.5 mt-1.5">
            <div className="flex-1 border border-[var(--border)] bg-[var(--surface)] rounded-2xl p-3.5">
              <div className="text-[11px] text-[var(--text-secondary)]">Contas</div>
              <div className="text-[15px] font-semibold mt-1 text-[var(--text-primary)]">{formatBRLCompact(liquid)}</div>
            </div>
            <div className="flex-1 border border-[var(--border)] bg-[var(--surface)] rounded-2xl p-3.5">
              <div className="text-[11px] text-[var(--text-secondary)]">Investido</div>
              <div className="text-[15px] font-semibold mt-1" style={{ color: "var(--accent)" }}>{formatBRLCompact(invested)}</div>
            </div>
          </div>
          <div className="text-xs text-[var(--text-secondary)] my-4.5">Recentes</div>
          {(txPage?.items ?? []).map((t) => (
            <div key={t.id} className="flex items-center gap-2.5 py-2">
              <div className="w-8 h-8 rounded-[11px] bg-[var(--surface-2)] flex items-center justify-center text-[11px] font-semibold text-[var(--text-secondary)]">
                {(t.description ?? t.category_name ?? "?").slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate text-[var(--text-primary)]">{t.description ?? t.category_name}</div>
                <div className="text-[10.5px] text-[var(--text-muted)]">{t.category_name}</div>
              </div>
              <b className="text-xs font-semibold" style={{ color: t.transaction_type === "income" ? "var(--accent)" : "var(--danger)" }}>
                {t.transaction_type === "income" ? "+" : "-"} {formatBRLCompact(Number(t.amount))}
              </b>
            </div>
          ))}
        </PhoneFrame>

        {/* Carteira */}
        <PhoneFrame delay={0.1}>
          <div className="text-base font-semibold tracking-[-.03em] text-[var(--text-primary)]">Carteira</div>
          <div className="border border-[var(--border)] bg-[var(--surface)] rounded-[20px] p-4.5 mt-3.5">
            <div className="text-[11px] text-[var(--text-secondary)]">Total investido</div>
            <div className="text-2xl font-semibold tracking-[-.04em] mt-1 text-[var(--text-primary)]">{formatBRLCompact(invested)}</div>
            <div className="text-xs mt-1" style={{ color: (summary?.total_pnl_percent ?? 0) >= 0 ? "var(--accent)" : "var(--danger)" }}>
              {(summary?.total_pnl_percent ?? 0) >= 0 ? "+" : ""}{(summary?.total_pnl_percent ?? 0).toFixed(1)}%
            </div>
          </div>
          <div className="text-xs text-[var(--text-secondary)] my-4.5">Posições</div>
          {positions.length === 0 ? (
            <p className="text-[11.5px] text-[var(--text-muted)]">Sem posições ainda.</p>
          ) : (
            positions.map((p) => (
              <div key={p.position_id} className="flex items-center gap-2.5 py-2.5 border-b border-[var(--border)]">
                <div className="w-8 h-8 rounded-[11px] bg-[var(--surface-2)] flex items-center justify-center text-[10.5px] font-bold text-[var(--text-secondary)]">
                  {p.ticker.slice(0, 2)}
                </div>
                <div className="flex-1">
                  <div className="text-xs font-semibold text-[var(--text-primary)]">{p.ticker}</div>
                  <div className="text-[10.5px] text-[var(--text-muted)]">{Number(p.quantity).toFixed(0)}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold text-[var(--text-primary)]">{formatBRLCompact(p.current_price ?? 0)}</div>
                  <div className="text-[10.5px]" style={{ color: p.pnl_percent >= 0 ? "var(--accent)" : "var(--danger)" }}>
                    {p.pnl_percent >= 0 ? "+" : ""}{p.pnl_percent.toFixed(1)}%
                  </div>
                </div>
              </div>
            ))
          )}
        </PhoneFrame>

        {/* Cartões */}
        <PhoneFrame delay={0.2}>
          <div className="text-base font-semibold tracking-[-.03em] text-[var(--text-primary)]">Cartões</div>
          {activeCard ? (
            <>
              <div className="h-[150px] rounded-[22px] mt-3.5 p-4.5 flex flex-col justify-between" style={{ background: "linear-gradient(140deg,#14161C,#2B303B)" }}>
                <div className="flex justify-between">
                  <span className="text-xs font-semibold text-[#F2F4F7]">{activeCard.name}</span>
                  <div className="w-7 h-5 rounded-[5px]" style={{ background: "linear-gradient(135deg,#D7C089,#9E874A)" }} />
                </div>
                <div>
                  <div className="text-sm tracking-[.12em] text-[#F2F4F7]">•••• {activeCard.last4 ?? "----"}</div>
                </div>
              </div>
              <div className="border border-[var(--border)] bg-[var(--surface)] rounded-[20px] p-4.5 mt-3.5">
                <div className="text-[11px] text-[var(--text-secondary)]">Limite cadastrado</div>
                <div className="text-sm font-semibold mt-1 text-[var(--text-primary)]">
                  {activeCard.credit_limit ? formatBRLCompact(activeCard.credit_limit) : "—"}
                </div>
              </div>
            </>
          ) : (
            <p className="text-[11.5px] text-[var(--text-muted)] mt-4">Nenhum cartão cadastrado ainda.</p>
          )}
        </PhoneFrame>
      </div>
    </div>
  );
}
