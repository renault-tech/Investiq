"use client";

import { GripVertical, X } from "lucide-react";
import { GRID_COLUMNS, SPAN_LABELS, SPAN_PRESETS } from "@/lib/dashboard-layout";

interface DashboardCardProps {
  id: string;
  label: string;
  /** Modo de personalização ligado: mostra alça de arraste, tamanhos e fechar. */
  customize: boolean;
  span: number;
  minSpan?: number;
  order: number;
  dragged: string | null;
  onDragStart: (id: string) => void;
  onDrop: (id: string) => void;
  onHide: (id: string) => void;
  onSpanChange: (id: string, span: number) => void;
  delay?: number;
  className?: string;
  /** Repassado ao elemento raiz — usado pelo tour guiado para achar o card. */
  "data-tour"?: string;
  children: React.ReactNode;
}

/** Card de painel: posição e largura ajustáveis pelo usuário.
 *
 * A largura vira `grid-column: span N` num grid de 12 colunas, mas só a
 * partir do breakpoint `md` — num celular qualquer card ocupa a linha
 * inteira, porque ½ de uma tela de 380px não cabe nada legível. É por isso
 * que o span vai numa CSS custom property em vez de ir direto no
 * `gridColumn`: o media query no globals.css decide quando aplicá-lo.
 */
export function DashboardCard({
  id,
  label,
  customize,
  span,
  minSpan = 1,
  order,
  dragged,
  onDragStart,
  onDrop,
  onHide,
  onSpanChange,
  delay = 0,
  className = "",
  "data-tour": dataTour,
  children,
}: DashboardCardProps) {
  const presets = SPAN_PRESETS.filter((preset) => preset >= minSpan);

  return (
    <section
      data-tour={dataTour}
      draggable={customize}
      onDragStart={() => onDragStart(id)}
      onDragOver={(e) => {
        if (dragged && dragged !== id) e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (dragged && dragged !== id) onDrop(id);
      }}
      style={
        {
          order,
          "--card-span": Math.min(GRID_COLUMNS, span),
          animationDelay: `${delay}s`,
        } as React.CSSProperties
      }
      className={`dashboard-card animate-rise-up relative border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card)] p-6 shadow-[var(--shadow)] overflow-hidden ${
        customize ? "cursor-grab active:cursor-grabbing ring-1 ring-[var(--border-strong)]" : ""
      } ${dragged === id ? "opacity-50" : ""} ${className}`}
    >
      {children}

      {customize && (
        <div className="absolute top-3 right-3 flex items-center gap-1 z-10">
          <div
            className="flex items-center rounded-lg border border-[var(--border-strong)] bg-[var(--surface-3)] overflow-hidden"
            role="group"
            aria-label={`Largura de ${label}`}
          >
            {presets.map((preset) => (
              <button
                key={preset}
                onClick={() => onSpanChange(id, preset)}
                aria-label={`${label}: largura ${SPAN_LABELS[preset]}`}
                aria-pressed={span === preset}
                title={`Ocupar ${SPAN_LABELS[preset]} da largura`}
                className="min-w-[26px] h-[26px] text-[11px] font-medium transition-colors"
                style={{
                  color: span === preset ? "var(--accent)" : "var(--text-secondary)",
                  background: span === preset ? "var(--glow)" : "transparent",
                }}
              >
                {SPAN_LABELS[preset]}
              </button>
            ))}
          </div>
          <span
            className="w-[26px] h-[26px] rounded-lg bg-[var(--surface-3)] border border-[var(--border-strong)] text-[var(--text-secondary)] flex items-center justify-center"
            title="Arraste para reposicionar"
          >
            <GripVertical size={14} />
          </span>
          <button
            onClick={() => onHide(id)}
            className="w-[26px] h-[26px] rounded-lg bg-[var(--surface-3)] border border-[var(--border-strong)] text-[var(--text-secondary)] flex items-center justify-center"
            aria-label={`Ocultar ${label}`}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </section>
  );
}
