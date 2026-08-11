"use client";

import { MarketOverviewStrip } from "./MarketOverviewStrip";
import { WatchlistTable } from "./WatchlistTable";
import { AlertsManager } from "./AlertsManager";

export function TraderClient() {
  return (
    <div className="p-[26px_30px_60px]">
      <MarketOverviewStrip />

      <div className="responsive-grid-12 grid gap-[18px] mt-[18px]" style={{ gridTemplateColumns: "repeat(12,1fr)" }}>
        <section
          className="col-span-7 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card)] p-6 shadow-[var(--shadow)] animate-rise-up"
          style={{ animationDelay: ".05s" }}
        >
          <div className="text-sm font-semibold text-[var(--text-primary)] mb-1">Watchlist</div>
          <div className="text-[11.5px] text-[var(--text-secondary)] mb-4">
            Acompanhe qualquer ativo sem precisar comprá-lo
          </div>
          <WatchlistTable />
        </section>

        <section
          className="col-span-5 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card)] p-6 shadow-[var(--shadow)] animate-rise-up"
          style={{ animationDelay: ".1s" }}
        >
          <div className="text-sm font-semibold text-[var(--text-primary)] mb-1">Meus alertas</div>
          <div className="text-[11.5px] text-[var(--text-secondary)] mb-4">
            Avisos de preço para qualquer ticker, monitorados a cada minuto
          </div>
          <AlertsManager />
        </section>
      </div>
    </div>
  );
}
