"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import { Loader2 } from "lucide-react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-[var(--navy)] text-white hover:opacity-90 disabled:opacity-50",
  secondary:
    "border border-[var(--accent)] text-[var(--accent)] hover:bg-emerald-50 dark:hover:bg-emerald-950/30 disabled:opacity-50",
  ghost:
    "text-[var(--text-secondary)] hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50",
  danger: "bg-[var(--danger)] text-white hover:opacity-90 disabled:opacity-50",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, disabled, className = "", children, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...rest}
    >
      {loading && <Loader2 size={size === "sm" ? 13 : 15} className="animate-spin" />}
      {children}
    </button>
  );
});
