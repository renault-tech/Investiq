"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, TrendingUp, BarChart2, LineChart, Settings, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { listPortfolios } from "@/lib/portfolio-api";

interface SearchResult {
  id: string;
  label: string;
  sublabel?: string;
  href: string;
  icon: React.ElementType;
  group: string;
}

const STATIC_ITEMS: SearchResult[] = [
  { id: "nav-investments", label: "Investimentos", sublabel: "Ver portfólios e posições", href: "/investments", icon: TrendingUp, group: "Páginas" },
  { id: "nav-finances", label: "Finanças", sublabel: "Receitas, despesas e fluxo de caixa", href: "/finances", icon: BarChart2, group: "Páginas" },
  { id: "nav-analysis", label: "Análise de Portfólio", sublabel: "Insights com IA", href: "/analysis", icon: LineChart, group: "Páginas" },
  { id: "nav-settings", label: "Configurações", sublabel: "Tema, API keys, provedor LLM", href: "/settings", icon: Settings, group: "Páginas" },
];

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const { data: portfolios } = useQuery({
    queryKey: ["portfolios"],
    queryFn: listPortfolios,
    staleTime: 30_000,
    enabled: open,
  });

  const portfolioItems: SearchResult[] = (portfolios ?? []).map((p) => ({
    id: `portfolio-${p.id}`,
    label: p.name,
    sublabel: `${p.currency} · ${p.is_default ? "Padrão" : "Portfólio"}`,
    href: `/investments?portfolio=${p.id}`,
    icon: TrendingUp,
    group: "Portfólios",
  }));

  const allItems = [...STATIC_ITEMS, ...portfolioItems];

  const filtered = query.trim()
    ? allItems.filter(
        (item) =>
          item.label.toLowerCase().includes(query.toLowerCase()) ||
          item.sublabel?.toLowerCase().includes(query.toLowerCase())
      )
    : allItems;

  const grouped = filtered.reduce<Record<string, SearchResult[]>>((acc, item) => {
    (acc[item.group] ??= []).push(item);
    return acc;
  }, {});

  const flat = Object.values(grouped).flat();

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const navigate = useCallback(
    (item: SearchResult) => {
      router.push(item.href);
      onClose();
    },
    [router, onClose]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (flat[activeIndex]) navigate(flat[activeIndex]);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  if (!open) return null;

  let flatIdx = 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--border)]">
          <Search size={16} className="text-[var(--text-muted)] flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar página, portfólio..."
            className="flex-1 bg-transparent outline-none text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              <X size={14} />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-[var(--text-muted)] bg-[var(--background)] border border-[var(--border)] rounded">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-2">
          {flat.length === 0 ? (
            <p className="px-4 py-6 text-sm text-[var(--text-muted)] text-center">
              Nenhum resultado para &ldquo;{query}&rdquo;
            </p>
          ) : (
            Object.entries(grouped).map(([group, items]) => (
              <div key={group}>
                <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  {group}
                </p>
                {items.map((item) => {
                  const idx = flatIdx++;
                  const isActive = idx === activeIndex;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => navigate(item)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        isActive
                          ? "bg-[var(--navy)] text-white"
                          : "text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isActive ? "bg-white/20" : "bg-slate-100 dark:bg-slate-800"
                      }`}>
                        <Icon size={14} className={isActive ? "text-white" : "text-[var(--text-muted)]"} />
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-medium truncate ${isActive ? "text-white" : ""}`}>
                          {item.label}
                        </p>
                        {item.sublabel && (
                          <p className={`text-[11px] truncate ${isActive ? "text-white/70" : "text-[var(--text-muted)]"}`}>
                            {item.sublabel}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-[var(--border)] flex items-center gap-3 text-[10px] text-[var(--text-muted)]">
          <span><kbd className="font-mono">↑↓</kbd> navegar</span>
          <span><kbd className="font-mono">↵</kbd> abrir</span>
          <span><kbd className="font-mono">ESC</kbd> fechar</span>
        </div>
      </div>
    </div>
  );
}
