interface RebalanceTagProps {
  action: "buy" | "sell" | "hold" | null;
  deltaUnits: number | null;
}

export function RebalanceTag({ action, deltaUnits }: RebalanceTagProps) {
  if (!action || action === "hold") return <span className="text-neutral-600">—</span>;

  const isBuy = action === "buy";
  return (
    <span
      className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded ${
        isBuy
          ? "bg-blue-950 text-blue-400"
          : "bg-red-950 text-red-400"
      }`}
    >
      {isBuy ? "COMPRAR" : "VENDER"}
      {deltaUnits !== null && (
        <span className="opacity-70">{Math.abs(deltaUnits).toFixed(2)}</span>
      )}
    </span>
  );
}
