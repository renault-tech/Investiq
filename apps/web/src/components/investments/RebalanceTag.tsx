interface RebalanceTagProps {
  action: "buy" | "sell" | "hold" | null;
  deltaUnits: number | null;
}

export function RebalanceTag({ action, deltaUnits }: RebalanceTagProps) {
  if (!action || action === "hold") return <span className="text-[var(--text-muted)]">—</span>;

  const isBuy = action === "buy";
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md"
      style={{
        background: isBuy ? "var(--glow)" : "rgba(255,107,122,.14)",
        color: isBuy ? "var(--accent)" : "var(--danger)",
      }}
    >
      {isBuy ? "COMPRAR" : "VENDER"}
      {deltaUnits !== null && (
        <span className="opacity-70">{Math.abs(deltaUnits).toFixed(2)}</span>
      )}
    </span>
  );
}
