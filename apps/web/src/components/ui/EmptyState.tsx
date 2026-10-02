"use client";

import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  /** "sm" dentro de cards de painel: o padrão (py-12) foi pensado para uma
   *  tela vazia inteira e, num card de ¼, empurrava a linha toda para baixo. */
  size?: "md" | "sm";
}

export function EmptyState({ icon: Icon, title, description, action, size = "md" }: EmptyStateProps) {
  const sm = size === "sm";
  return (
    <div className={`flex flex-col items-center justify-center text-center text-[var(--text-muted)] ${sm ? "gap-2 py-5" : "gap-3 py-12"}`}>
      <Icon size={sm ? 20 : 28} />
      <div>
        <p className={`font-medium text-[var(--text-secondary)] ${sm ? "text-[12.5px]" : ""}`}>{title}</p>
        {description && <p className={`mt-1 ${sm ? "text-[11.5px]" : "text-sm"}`}>{description}</p>}
      </div>
      {action}
    </div>
  );
}
