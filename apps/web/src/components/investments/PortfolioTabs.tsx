import type { Portfolio } from "@/lib/portfolio-api";

interface Props {
  portfolios: Portfolio[];
  activeId: string | null;
  onChange: (id: string) => void;
}

export function PortfolioTabs({ portfolios, activeId, onChange }: Props) {
  if (portfolios.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto">
      {portfolios.map((portfolio) => (
        <button
          key={portfolio.id}
          onClick={() => onChange(portfolio.id)}
          className={
            portfolio.id === activeId
              ? "px-3 py-1 text-sm rounded-full bg-[var(--navy)] text-white shrink-0"
              : "px-3 py-1 text-sm rounded-full bg-slate-100 dark:bg-slate-800 text-[var(--text-secondary)] hover:bg-neutral-700 shrink-0"
          }
        >
          {portfolio.name}
        </button>
      ))}
    </div>
  );
}
