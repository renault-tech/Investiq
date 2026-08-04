"use client";

export interface IndicatorState {
  sma: boolean;
  ema: boolean;
  bollinger: boolean;
  rsi: boolean;
  macd: boolean;
}

export const DEFAULT_INDICATOR_STATE: IndicatorState = {
  sma: true,
  ema: false,
  bollinger: false,
  rsi: false,
  macd: false,
};

const LABELS: { key: keyof IndicatorState; label: string }[] = [
  { key: "sma", label: "SMA 20/50/200" },
  { key: "ema", label: "EMA 9/21" },
  { key: "bollinger", label: "Bollinger" },
  { key: "rsi", label: "RSI" },
  { key: "macd", label: "MACD" },
];

interface IndicatorToggleProps {
  state: IndicatorState;
  onChange: (state: IndicatorState) => void;
}

export function IndicatorToggle({ state, onChange }: IndicatorToggleProps) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Indicadores técnicos">
      {LABELS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange({ ...state, [key]: !state[key] })}
          aria-pressed={state[key]}
          className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
            state[key]
              ? "bg-[var(--navy)] text-white border-[var(--navy)]"
              : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
