"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { X } from "lucide-react";
import type { TourStep } from "@/lib/tutorials";

interface TourBalloonProps {
  step: TourStep;
  index: number;
  total: number;
  screenLabel: string;
  onBack: () => void;
  onNext: () => void;
  onClose: () => void;
  onDismissAll: () => void;
}

interface Anchor {
  top: number;
  left: number;
  width: number;
  height: number;
}

const BALLOON_WIDTH = 320;
const GAP = 12;

/** Posição do balão junto ao alvo, mantido dentro da janela. Sem alvo (ou
 * com alvo ausente na tela), volta ao centro — uma tela que ainda não
 * renderizou o elemento não pode deixar o balão fora de vista. */
function useAnchor(target?: string): Anchor | null {
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  useLayoutEffect(() => {
    if (!target) {
      setAnchor(null);
      return;
    }
    const measure = () => {
      const el = document.querySelector(`[data-tour="${target}"]`);
      if (!el) {
        setAnchor(null);
        return;
      }
      const rect = el.getBoundingClientRect();
      setAnchor({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [target]);

  return anchor;
}

export function TourBalloon({
  step,
  index,
  total,
  screenLabel,
  onBack,
  onNext,
  onClose,
  onDismissAll,
}: TourBalloonProps) {
  const anchor = useAnchor(step.target);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isLast = index + 1 >= total;

  const position: React.CSSProperties = anchor
    ? {
        // Abaixo do alvo, a não ser que não caiba — aí sobe para cima dele.
        top:
          anchor.top + anchor.height + GAP + 200 > window.innerHeight
            ? Math.max(GAP, anchor.top - 200 - GAP)
            : anchor.top + anchor.height + GAP,
        left: Math.min(
          Math.max(GAP, anchor.left),
          Math.max(GAP, window.innerWidth - BALLOON_WIDTH - GAP)
        ),
      }
    : { top: "50%", left: "50%", transform: "translate(-50%,-50%)" };

  return (
    <>
      <div
        className="fixed inset-0 z-[90]"
        style={{ background: "rgba(2,6,12,.55)" }}
        onClick={onClose}
        aria-hidden
      />
      {anchor && (
        <div
          className="fixed z-[91] rounded-[12px] pointer-events-none"
          style={{
            top: anchor.top - 4,
            left: anchor.left - 4,
            width: anchor.width + 8,
            height: anchor.height + 8,
            outline: "2px solid var(--accent)",
            boxShadow: "0 0 0 9999px rgba(2,6,12,.0)",
          }}
          aria-hidden
        />
      )}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Tutorial: ${step.title}`}
        className="fixed z-[92] rounded-[14px] border border-[var(--border-strong)] bg-[var(--surface)] shadow-lg p-4"
        style={{ width: BALLOON_WIDTH, ...position }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="text-[10.5px] tracking-[.1em] uppercase text-[var(--accent)]">
            {screenLabel} · {index + 1}/{total}
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar tutorial"
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] -mt-0.5"
          >
            <X size={15} />
          </button>
        </div>

        <h3 className="text-[14px] font-semibold text-[var(--text-primary)] mt-1.5">{step.title}</h3>
        <p className="text-[12.5px] text-[var(--text-secondary)] leading-relaxed mt-1.5">
          {step.body}
        </p>

        <div className="flex items-center justify-between gap-2 mt-4">
          <button
            onClick={onDismissAll}
            className="text-[11.5px] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          >
            Não mostrar mais
          </button>
          <div className="flex items-center gap-1.5">
            {index > 0 && (
              <button
                onClick={onBack}
                className="px-3 h-[30px] rounded-[9px] border border-[var(--border)] text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Voltar
              </button>
            )}
            <button
              onClick={onNext}
              className="px-3.5 h-[30px] rounded-[9px] text-[12px] font-semibold"
              style={{ background: "var(--accent)", color: "#04120D" }}
            >
              {isLast ? "Entendi" : "Próximo"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
