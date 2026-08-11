"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Plus, Star, Trash2 } from "lucide-react";
import { useWatchlist, useAddToWatchlist, useRemoveFromWatchlist } from "@/hooks/useWatchlist";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { useMask } from "@/hooks/useMask";

function formatPrice(price: number | null, currency: string): string {
  if (price == null) return "indisponível";
  return price.toLocaleString("pt-BR", { style: "currency", currency: currency === "BRL" ? "BRL" : "USD" });
}

export function WatchlistTable() {
  const { data: items = [], isLoading } = useWatchlist();
  const addMutation = useAddToWatchlist();
  const removeMutation = useRemoveFromWatchlist();
  const mask = useMask();
  const [ticker, setTicker] = useState("");

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const t = ticker.trim().toUpperCase();
    if (!t) return;
    addMutation.mutate(t, { onSuccess: () => setTicker("") });
  };

  return (
    <div>
      <form onSubmit={handleAdd} className="flex items-center gap-2 mb-4">
        <input
          type="text"
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          placeholder="Adicionar ticker (ex: PETR4, AAPL)"
          className="flex-1 px-3 py-2 text-sm border border-[var(--border)] rounded-[11px] bg-[var(--surface-2)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        />
        <Button type="submit" size="sm" loading={addMutation.isPending}>
          <Plus size={14} /> Adicionar
        </Button>
      </form>

      {!isLoading && items.length === 0 ? (
        <EmptyState
          icon={Star}
          title="Sua watchlist está vazia."
          description="Adicione um ticker para acompanhar preço e criar alertas sem precisar comprar."
        />
      ) : (
        <div className="space-y-1.5">
          {items.map((item) => {
            const positive = (item.change_pct ?? 0) >= 0;
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-[11px] hover:bg-[var(--surface-2)] transition-colors group"
              >
                <Link href={`/investments/${encodeURIComponent(item.ticker)}`} className="flex-1 min-w-0 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-[10px] bg-[var(--surface-2)] flex items-center justify-center text-[10.5px] font-bold text-[var(--text-secondary)] flex-shrink-0">
                    {item.ticker.slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-[var(--text-primary)]">{item.ticker}</div>
                    <div className="text-[11px] text-[var(--text-muted)] truncate">{item.name}</div>
                  </div>
                </Link>
                <div className="text-right">
                  <div className="text-[13px] font-semibold tabular-nums text-[var(--text-primary)]">
                    {mask(formatPrice(item.price, item.currency))}
                  </div>
                  <div
                    className="flex items-center justify-end gap-0.5 text-[11px]"
                    style={{ color: item.change_pct == null ? "var(--text-muted)" : positive ? "var(--accent)" : "var(--danger)" }}
                  >
                    {item.change_pct != null && (positive ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />)}
                    {item.change_pct != null ? `${positive ? "+" : ""}${item.change_pct.toFixed(2)}%` : "—"}
                  </div>
                </div>
                <button
                  onClick={() => removeMutation.mutate(item.id)}
                  aria-label={`Remover ${item.ticker} da watchlist`}
                  className="text-[var(--text-muted)] hover:text-[var(--danger)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
