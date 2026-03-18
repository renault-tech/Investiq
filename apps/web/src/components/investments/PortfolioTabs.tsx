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
              ? "px-3 py-1 text-sm rounded-full bg-blue-600 text-white shrink-0"
              : "px-3 py-1 text-sm rounded-full bg-neutral-800 text-neutral-300 hover:bg-neutral-700 shrink-0"
          }
        >
          {portfolio.name}
        </button>
      ))}
    </div>
  );
}
