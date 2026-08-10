"use client";

import { ReactNode, useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl";
}

const MAX_WIDTH_CLASSES = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg", xl: "max-w-xl" };

/** Overlay + card consolidado — ESC fecha, click fora fecha, scroll interno, foco preso ao título. */
export function Modal({ title, onClose, children, footer, maxWidth = "md" }: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    dialogRef.current?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`bg-[var(--surface)] border border-[var(--border)] rounded-lg w-full ${MAX_WIDTH_CLASSES[maxWidth]} max-h-[90vh] overflow-y-auto outline-none`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h2 id={titleId} className="font-semibold text-[var(--text-primary)]">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4">{children}</div>

        {footer && <div className="flex justify-end gap-2 p-4 border-t border-[var(--border)]">{footer}</div>}
      </div>
    </div>
  );
}
