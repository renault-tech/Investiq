"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, X, Sparkles } from "lucide-react";
import { useOnboardingStatus } from "@/hooks/useOnboarding";
import { OnboardingStatus } from "@/lib/onboarding-api";

const DISMISS_KEY = "investiq_onboarding_dismissed";

interface Step {
  key: keyof OnboardingStatus;
  label: string;
  href: string;
}

const STEPS: Step[] = [
  { key: "has_portfolio", label: "Criar uma carteira", href: "/investments" },
  { key: "has_position", label: "Adicionar um ativo", href: "/investments" },
  { key: "has_transaction", label: "Registrar uma transação de investimento", href: "/investments" },
  { key: "has_finance_transaction", label: "Registrar um gasto ou receita", href: "/finances" },
  { key: "has_goal", label: "Criar uma meta de poupança", href: "/goals" },
];

export function OnboardingChecklist() {
  const { data: status } = useOnboardingStatus();
  const [dismissed, setDismissed] = useState(true); // começa oculto até checar localStorage (evita flash)

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "true");
  }, []);

  if (!status || dismissed) return null;

  const doneCount = STEPS.filter((s) => status[s.key]).length;
  if (doneCount === STEPS.length) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "true");
    setDismissed(true);
  };

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-card-sm)] p-5 mb-[18px] shadow-[var(--shadow)]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text-primary)]">
          <Sparkles size={15} className="text-[var(--accent)]" />
          Primeiros passos
          <span className="text-xs font-normal text-[var(--text-muted)]">
            ({doneCount}/{STEPS.length})
          </span>
        </h3>
        <button
          onClick={handleDismiss}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          aria-label="Esconder lista de primeiros passos"
        >
          <X size={15} />
        </button>
      </div>

      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mb-3">
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-all"
          style={{ width: `${(doneCount / STEPS.length) * 100}%` }}
        />
      </div>

      <ul className="space-y-1.5">
        {STEPS.map((step) => {
          const done = status[step.key];
          return (
            <li key={step.key}>
              {done ? (
                <span className="flex items-center gap-2 text-xs text-[var(--text-muted)] line-through">
                  <CheckCircle2 size={14} className="text-[var(--accent)] shrink-0" />
                  {step.label}
                </span>
              ) : (
                <Link
                  href={step.href}
                  className="flex items-center gap-2 text-xs text-[var(--text-primary)] hover:text-[var(--navy)] dark:hover:text-[var(--accent)]"
                >
                  <Circle size={14} className="text-[var(--text-muted)] shrink-0" />
                  {step.label}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
