interface RebalanceTagProps {
  action: "buy" | "sell" | "hold" | null;
  deltaUnits: number | null;
}

export function RebalanceTag({ action, deltaUnits }: RebalanceTagProps) {
  if (!action || action === "hold") return <span className="text-[var(--text-muted)]">—</span>;

  const isBuy = action === "buy";
  return (
    <span
      className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded ${
        isBuy
          ? "bg-emerald-100 dark:bg-emerald-950/40 text-[var(--accent)]"
          : "bg-red-100 dark:bg-red-950/40 text-[var(--danger)]"
      }`}
    >
      {isBuy ? "COMPRAR" : "VENDER"}
      {deltaUnits !== null && (
        <span className="opacity-70">{Math.abs(deltaUnits).toFixed(2)}</span>
      )}
    </span>
  );
}
