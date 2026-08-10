"use client";

interface Segment {
  fraction: number; // 0..1
  color: string;
}

interface Props {
  segments: Segment[];
  size?: number;
  strokeWidth?: number;
  trackColor?: string;
  className?: string;
}

/** Anel donut multi-segmento (alocação, saúde financeira, progresso de meta).
 * `segments` recebe frações (não precisam somar 1 — o restante fica vazio). */
export function DonutRing({ segments, size = 132, strokeWidth = 16, trackColor = "var(--surface-3)", className = "" }: Props) {
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;

  let cumulative = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={className} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
      {segments.map((seg, i) => {
        const len = Math.max(0, seg.fraction) * circumference;
        const gap = circumference - len;
        const offset = -cumulative * circumference;
        cumulative += seg.fraction;
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${len.toFixed(1)} ${gap.toFixed(1)}`}
            strokeDashoffset={offset.toFixed(1)}
            strokeLinecap="round"
            className="animate-ring"
            style={{ animationDelay: `${i * 0.12}s` }}
          />
        );
      })}
    </svg>
  );
}
