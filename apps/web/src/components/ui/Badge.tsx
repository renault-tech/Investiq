"use client";

import { ReactNode } from "react";

export type BadgeTone = "neutral" | "positive" | "negative" | "warning" | "info";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 dark:bg-slate-800 text-[var(--text-secondary)]",
  positive: "bg-emerald-100 dark:bg-emerald-950/40 text-[var(--accent)]",
  negative: "bg-red-100 dark:bg-red-950/40 text-[var(--danger)]",
  warning: "bg-amber-100 dark:bg-amber-950/40 text-[var(--warning)]",
  info: "bg-blue-100 dark:bg-blue-950/40 text-[var(--navy)] dark:text-blue-300",
};

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}

export function Badge({ tone = "neutral", children, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
