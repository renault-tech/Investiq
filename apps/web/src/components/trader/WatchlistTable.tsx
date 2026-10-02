"use client";

import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, Plus, Star, Trash2 } from "lucide-react";
import { useWatchlist, useAddToWatchlist, useRemoveFromWatchlist } from "@/hooks/useWatchlist";
import { EmptyState } from "@/components/ui/EmptyState";
import { useMask } from "@/hooks/useMask";
import { formatPercent } from "@/lib/number-format";

function formatPrice(price: number | null, currency: string): string {
  if (price == null) return "—";
  return price.toLocaleString("pt-BR", { style: "currency", currency: currency === "BRL" ? "BRL" : "USD" });
}

interface WatchlistTableProps {
  /** Ticker selecionado no terminal — a linha correspondente fica destacada
   * e o clique nas outras troca o gráfico/indicadores em vez de navegar
   * pra uma página separada (é o que faz isto um terminal, não uma lista). */
  selected?: string | null;
  onSelect?: (ticker: string) => void;
}

// Sugestões para a watchlist vazia: os papéis mais negociados da B3 e os ETFs
// de índice — um clique adiciona, em vez de a tela inteira ficar parada
// esperando a pessoa saber o que digitar.
const QUICK_ADD = ["PETR4", "VALE3", "ITUB4", "BBAS3", "WEGE3", "BOVA11", "IVVB11"];

export function WatchlistTable({ selected, onSelect }: WatchlistTableProps) {
  const { data: items = [], isLoading } = useWatchlist();
  const addMutation = useAddToWatchlist();
  const removeMutation = useRemoveFromWatchlist();
  const mask = useMask();
  const [showForm, setShowForm] = useState(false);
  const [ticker, setTicker] = useState("");

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const t = ticker.trim().toUpperCase();
    if (!t) return;
    addMutation.mutate(t, { onSuccess: () => { setTicker(""); setShowForm(false); onSelect?.(t); } });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-[var(--text-primary)]">Watchlist</div>
        <button
          onClick={() => setShowForm((v) => !v)}
          aria-label="Adicionar ticker à watchlist"
          className="w-6 h-6 flex items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)]"
        >
          <Plus size={15} />
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="flex items-center gap-1.5 mb-3">
          <input
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            placeholder="Ticker (ex: PETR4)"
            autoFocus
            className="flex-1 min-w-0 px-2.5 py-1.5 text-xs border border-[var(--border)] rounded-[9px] bg-[var(--surface-2)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
          <button
            type="submit"
            disabled={addMutation.isPending}
            className="px-2.5 py-1.5 text-xs font-medium rounded-[9px] disabled:opacity-50"
            style={{ background: "var(--accent)", color: "var(--on-accent)" }}
          >
            OK
          </button>
        </form>
      )}

      {!isLoading && items.length === 0 ? (
        <div>
          <EmptyState
            size="sm"
            icon={Star}
            title="Sua watchlist está vazia."
            description="Acompanhe preço e gráfico sem precisar comprar. Comece por um destes:"
          />
          <div className="flex flex-wrap justify-center gap-1.5">
            {QUICK_ADD.map((t) => (
              <button
                key={t}
                disabled={addMutation.isPending}
                onClick={() => addMutation.mutate(t, { onSuccess: () => onSelect?.(t) })}
                className="flex items-center gap-1 px-2.5 py-1 text-[11.5px] font-medium rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors disabled:opacity-50"
              >
                <Plus size={11} /> {t}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          {items.map((item) => {
            const positive = (item.change_pct ?? 0) >= 0;
            const isSelected = selected === item.ticker;
            return (
              <div
                key={item.id}
                onClick={() => onSelect?.(item.ticker)}
                className="flex items-center gap-2 px-2.5 py-2 rounded-[10px] cursor-pointer transition-colors group"
                style={{ background: isSelected ? "var(--surface-3)" : "transparent" }}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-[var(--text-primary)]">{item.ticker}</div>
                  <div className="text-[12px] font-mono tabular-nums text-[var(--text-secondary)]">{mask(formatPrice(item.price, item.currency))}</div>
                </div>
                <div
                  className="flex items-center gap-0.5 text-[11.5px] flex-shrink-0"
                  style={{ color: item.change_pct == null ? "var(--text-muted)" : positive ? "var(--accent)" : "var(--danger)" }}
                >
                  {item.change_pct != null && (positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />)}
                  {item.change_pct != null ? formatPercent(item.change_pct, 2, { signed: true }) : "—"}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); removeMutation.mutate(item.id); }}
                  aria-label={`Remover ${item.ticker} da watchlist`}
                  className="text-[var(--text-muted)] hover:text-[var(--danger)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 p-1 -m-1"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
