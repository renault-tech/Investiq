interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  subColor?: "green" | "red" | "neutral";
}

export function KpiCard({ label, value, sub, subColor = "neutral" }: KpiCardProps) {
  const subColorClass =
    subColor === "green"
      ? "text-green-500"
      : subColor === "red"
      ? "text-red-500"
      : "text-neutral-500";

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3">
      <p className="text-[9px] uppercase tracking-widest text-neutral-600 mb-1">{label}</p>
      <p className="text-[17px] font-bold text-white leading-none">{value}</p>
      {sub && <p className={`text-[10px] mt-1 ${subColorClass}`}>{sub}</p>}
    </div>
  );
}
