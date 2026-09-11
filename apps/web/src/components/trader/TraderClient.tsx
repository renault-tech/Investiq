"use client";

import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { MarketOverviewStrip } from "./MarketOverviewStrip";
import { WatchlistTable } from "./WatchlistTable";
import { AlertsManager } from "./AlertsManager";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useAssetHistory, useAssetIndicators } from "@/hooks/useAssetData";
import { usePortfolioSummary } from "@/hooks/usePortfolioSummary";
import { CONSOLIDATED_ID } from "@/lib/portfolio-api";
import { getAssetHistory, getAssetIndicators, type HistoryPeriod } from "@/lib/market-api";
import { listPositionTransactions } from "@/lib/portfolio-api";
import { computeClosedTrades } from "@/lib/trade-journal";
import { rsiStatus, macdStatus, movingAveragesAbove, volatility30d, computeSetup } from "@/lib/technical-radar";
import { IndicatorToggle, IndicatorState, DEFAULT_INDICATOR_STATE } from "@/components/asset/IndicatorToggle";
import { CandlestickChart } from "@/components/asset/CandlestickChart";
import { useMask } from "@/hooks/useMask";
import { formatBRLExact } from "@/components/charts/chartTheme";
import { formatPercent } from "@/lib/number-format";
import { EmptyState } from "@/components/ui/EmptyState";
import { BarChart3, Bell, NotebookPen } from "lucide-react";

const PERIODS: { value: HistoryPeriod; label: string }[] = [
  { value: "1mo", label: "1m" },
  { value: "3mo", label: "3m" },
  { value: "6mo", label: "6m" },
  { value: "1y", label: "1a" },
  { value: "5y", label: "5a" },
];

// Quantos tickers da watchlist entram no radar/rótulos de indicador —
// cada um dispara sua própria consulta de indicadores, então um limite
// evita N chamadas descontroladas numa watchlist grande.
const RADAR_LIMIT = 6;

export function TraderClient() {
  const mask = useMask();
  const { data: watchlist = [] } = useWatchlist();
  const [selected, setSelected] = useState<string | null>(null);
  const selectedTicker = selected ?? watchlist[0]?.ticker ?? null;
  const selectedItem = watchlist.find((w) => w.ticker === selectedTicker);

  const [period, setPeriod] = useState<HistoryPeriod>("1y");
  const [indicatorState, setIndicatorState] = useState<IndicatorState>(DEFAULT_INDICATOR_STATE);

  const { data: history, isLoading: historyLoading } = useAssetHistory(selectedTicker ?? "", period);
  const { data: indicators } = useAssetIndicators(selectedTicker ?? "", period, Boolean(selectedTicker));

  const bars = history?.bars ?? [];
  const lastRsi = indicators?.rsi.filter((p) => p.rsi != null).slice(-1)[0]?.rsi ?? null;
  const rsiRead = rsiStatus(lastRsi);
  const macdPoints = indicators?.macd.filter((p) => p.histogram != null) ?? [];
  const lastMacd = macdPoints.slice(-1)[0]?.histogram ?? null;
  const prevMacd = macdPoints.slice(-2)[0]?.histogram ?? null;
  const macdRead = macdStatus(lastMacd, prevMacd);
  const maRead = bars.length > 0 && indicators ? movingAveragesAbove(bars[bars.length - 1].close, indicators) : null;
  const vol30 = volatility30d(bars);

  // Radar de setups: indicadores de até RADAR_LIMIT tickers da watchlist,
  // período fixo em 6 meses (o suficiente pra SMA50 estabilizar).
  const radarTickers = watchlist.slice(0, RADAR_LIMIT).map((w) => w.ticker);
  const radarHistoryQueries = useQueries({
    queries: radarTickers.map((t) => ({
      queryKey: ["asset-history", t, "6mo"],
      queryFn: () => getAssetHistory(t, "6mo" as HistoryPeriod),
      staleTime: 5 * 60_000,
    })),
  });
  const radarIndicatorQueries = useQueries({
    queries: radarTickers.map((t) => ({
      queryKey: ["asset-indicators", t, "6mo"],
      queryFn: () => getAssetIndicators(t, "6mo" as HistoryPeriod),
      staleTime: 5 * 60_000,
    })),
  });
  const setups = useMemo(() => {
    return radarTickers
      .map((t, i) => {
        const h = radarHistoryQueries[i]?.data;
        const ind = radarIndicatorQueries[i]?.data;
        if (!h || !ind) return null;
        return computeSetup(t, h.bars, ind);
      })
      .filter((s): s is NonNullable<typeof s> => s !== null && s.action !== "watch")
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 4);
  }, [radarTickers, radarHistoryQueries, radarIndicatorQueries]);

  // Diário de trades: casa compra/venda por FIFO em cima das transações
  // reais de cada posição da carteira consolidada — não é um registro à
  // parte, é derivado do que já foi lançado em Investimentos.
  const { data: consolidated } = usePortfolioSummary(CONSOLIDATED_ID);
  const positions = consolidated?.positions ?? [];
  const txnQueries = useQueries({
    queries: positions.map((p) => ({
      queryKey: ["position-transactions", p.position_id],
      queryFn: () => listPositionTransactions(p.position_id),
      staleTime: 60_000,
    })),
  });
  const closedTrades = useMemo(() => {
    return positions
      .flatMap((p, i) => computeClosedTrades(p.ticker, txnQueries[i]?.data ?? []))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);
  }, [positions, txnQueries]);

  return (
    <div className="p-[26px_30px_60px]">
      <MarketOverviewStrip />

      <div className="responsive-grid-12 grid gap-[18px] mt-[18px]" style={{ gridTemplateColumns: "repeat(12,1fr)" }}>
        <section className="col-span-3 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card)] p-5 shadow-[var(--shadow)] animate-rise-up">
          <WatchlistTable selected={selectedTicker} onSelect={setSelected} />
        </section>

        <section className="col-span-9 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card)] p-6 shadow-[var(--shadow)] animate-rise-up" style={{ animationDelay: ".05s" }}>
          {!selectedTicker ? (
            <EmptyState icon={BarChart3} title="Selecione um ativo na watchlist" description="O gráfico e os indicadores aparecem aqui." />
          ) : (
            <>
              <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold text-[var(--text-primary)]">{selectedTicker}</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md" style={{ background: "var(--glow)", color: "var(--accent)" }}>AO VIVO</span>
                  </div>
                  <div className="text-[11.5px] text-[var(--text-secondary)] mt-0.5">
                    {selectedItem?.name ?? selectedTicker} · {selectedItem?.asset_type ?? ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-semibold tabular-nums text-[var(--text-primary)]">
                    {selectedItem?.price != null ? mask(formatBRLExact(selectedItem.price)) : "—"}
                  </div>
                  {selectedItem?.change_pct != null && (
                    <div className="flex items-center justify-end gap-1 text-[12.5px]" style={{ color: selectedItem.change_pct >= 0 ? "var(--accent)" : "var(--danger)" }}>
                      {selectedItem.change_pct >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                      {formatPercent(selectedItem.change_pct, 2, { signed: true })}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex rounded-[11px] border border-[var(--border)] overflow-hidden">
                  {PERIODS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setPeriod(p.value)}
                      className="px-2.5 py-1 text-xs transition-colors"
                      style={{ background: period === p.value ? "var(--surface-3)" : "transparent", color: period === p.value ? "var(--text-primary)" : "var(--text-secondary)" }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <IndicatorToggle state={indicatorState} onChange={setIndicatorState} />
              </div>

              {historyLoading ? (
                <div className="h-[360px] rounded-[var(--radius-card-sm)] bg-[var(--surface-2)] animate-pulse" />
              ) : bars.length === 0 ? (
                <div className="h-[360px] flex items-center justify-center text-[var(--text-muted)]">Sem dados de preço para {selectedTicker}.</div>
              ) : (
                <CandlestickChart bars={bars} indicators={indicators} state={indicatorState} />
              )}
            </>
          )}
        </section>
      </div>

      {selectedTicker && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-[18px] mt-[18px]">
          <div className="border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card-sm)] p-4">
            <div className="text-[11px] text-[var(--text-secondary)]">RSI (14)</div>
            <div className="text-xl font-semibold mt-1 tabular-nums" style={{ color: rsiRead.tone === "sell" ? "var(--danger)" : rsiRead.tone === "buy" ? "var(--accent)" : "var(--text-primary)" }}>
              {lastRsi != null ? lastRsi.toFixed(1) : "—"}
            </div>
            <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{rsiRead.label}</div>
          </div>
          <div className="border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card-sm)] p-4">
            <div className="text-[11px] text-[var(--text-secondary)]">MACD</div>
            <div className="text-xl font-semibold mt-1 tabular-nums" style={{ color: macdRead.tone === "sell" ? "var(--danger)" : macdRead.tone === "buy" ? "var(--accent)" : "var(--text-primary)" }}>
              {lastMacd != null ? (lastMacd >= 0 ? "+" : "") + lastMacd.toFixed(2) : "—"}
            </div>
            <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{macdRead.label}</div>
          </div>
          <div className="border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card-sm)] p-4">
            <div className="text-[11px] text-[var(--text-secondary)]">Médias móveis</div>
            <div className="text-xl font-semibold mt-1 tabular-nums text-[var(--text-primary)]">
              {maRead ? `${maRead.above} de ${maRead.total}` : "—"}
            </div>
            <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
              {maRead && maRead.above >= maRead.total / 2 ? "maioria compradoras" : "maioria vendedoras"}
            </div>
          </div>
          <div className="border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card-sm)] p-4">
            <div className="text-[11px] text-[var(--text-secondary)]">Volatilidade 30d</div>
            <div className="text-xl font-semibold mt-1 tabular-nums text-[var(--text-primary)]">
              {vol30 != null ? formatPercent(vol30, 1) : "—"}
            </div>
            <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{vol30 != null && vol30 > 4 ? "acima da média" : "dentro da média"}</div>
          </div>
        </div>
      )}

      <div className="responsive-grid-12 grid gap-[18px] mt-[18px]" style={{ gridTemplateColumns: "repeat(12,1fr)" }}>
        <section className="col-span-4 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card)] p-5 shadow-[var(--shadow)]">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-[var(--text-primary)]">Radar de setups</div>
            <span className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded-md" style={{ background: "var(--glow)", color: "var(--accent)" }}>PRO</span>
          </div>
          {setups.length === 0 ? (
            <p className="text-[12px] text-[var(--text-muted)]">Sem sinais nos ativos da watchlist agora.</p>
          ) : (
            <div className="space-y-3">
              {setups.map((s) => (
                <div key={s.ticker} className="pb-3 border-b border-[var(--border)] last:border-0 last:pb-0">
                  <div className="flex items-center gap-2 text-[12.5px]">
                    <span className="font-semibold text-[var(--text-primary)]">{s.ticker}</span>
                    <span
                      className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded-md"
                      style={{ background: s.action === "buy" ? "var(--glow)" : "rgba(255,107,122,.14)", color: s.action === "buy" ? "var(--accent)" : "var(--danger)" }}
                    >
                      {s.label}
                    </span>
                    <span className="ml-auto text-[10.5px] text-[var(--text-muted)]">força {s.strength.toFixed(1)}</span>
                  </div>
                  <p className="text-[11.5px] text-[var(--text-secondary)] mt-1">{s.detail}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="col-span-4 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card)] p-5 shadow-[var(--shadow)]">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text-primary)] mb-3">
            <Bell size={15} /> Alertas de preço
          </div>
          <AlertsManager />
        </section>

        <section className="col-span-4 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card)] p-5 shadow-[var(--shadow)]">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text-primary)] mb-1">
            <NotebookPen size={15} /> Diário de trades
          </div>
          <p className="text-[11.5px] text-[var(--text-secondary)] mb-3">Últimas operações fechadas</p>
          {closedTrades.length === 0 ? (
            <p className="text-[12px] text-[var(--text-muted)]">Nenhuma operação fechada ainda.</p>
          ) : (
            <ul className="space-y-2.5">
              {closedTrades.map((t) => (
                <li key={t.key} className="flex items-center gap-2.5 text-[12.5px]">
                  <span
                    className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded-md flex-shrink-0"
                    style={{ background: t.action === "buy" ? "var(--glow)" : "rgba(255,107,122,.14)", color: t.action === "buy" ? "var(--accent)" : "var(--danger)" }}
                  >
                    {t.action === "buy" ? "COMPRA" : "VENDA"}
                  </span>
                  <span className="font-medium text-[var(--text-primary)]">{t.ticker}</span>
                  <span className="ml-auto font-mono tabular-nums" style={{ color: t.pnl >= 0 ? "var(--accent)" : "var(--danger)" }}>
                    {mask(`${t.pnl >= 0 ? "+" : "-"}${formatBRLExact(Math.abs(t.pnl))}`)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
