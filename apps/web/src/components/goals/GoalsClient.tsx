"use client";

import { useState } from "react";
import { Plus, Target, Trash2, CheckCircle2 } from "lucide-react";
import { useGoals, useCreateGoal, useDeleteGoal, useContributeToGoal } from "@/hooks/useGoals";
import { useFinanceSummary } from "@/hooks/useFinance";
import { Goal } from "@/lib/goals-api";
import { formatBRLCompact, formatBRLExact, CATEGORICAL } from "@/components/charts/chartTheme";
import { DonutRing } from "@/components/charts/DonutRing";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useMask } from "@/hooks/useMask";
import { parseBRNumber } from "@/lib/number-format";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
}

/** "No ritmo" compara o quanto do prazo já passou com o quanto da meta já
 * foi juntado — sem prazo definido não há como avaliar ritmo. */
function paceStatus(goal: Goal): { label: string; color: string } | null {
  if (!goal.target_date || goal.is_complete) return null;
  const created = new Date(goal.created_at).getTime();
  const target = new Date(`${goal.target_date}T12:00:00`).getTime();
  const now = Date.now();
  if (target <= created) return null;
  const elapsedFraction = Math.min(1, Math.max(0, (now - created) / (target - created)));
  const progressFraction = Number(goal.pct_complete);
  if (now > target) return { label: "Prazo vencido", color: "var(--danger)" };
  if (progressFraction >= elapsedFraction + 0.05) return { label: "Adiantado", color: "var(--accent)" };
  if (progressFraction < elapsedFraction - 0.05) return { label: "Atrasado", color: "var(--warning)" };
  return { label: "No ritmo", color: "var(--text-secondary)" };
}

function GoalCard({ goal, index }: { goal: Goal; index: number }) {
  const [contribution, setContribution] = useState("");
  const mask = useMask();
  const contributeMutation = useContributeToGoal();
  const deleteMutation = useDeleteGoal();
  const pct = Math.min(Number(goal.pct_complete), 1);
  const color = goal.color ?? CATEGORICAL[index % CATEGORICAL.length];
  const status = paceStatus(goal);

  const handleContribute = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseBRNumber(contribution);
    if (!value) return;
    await contributeMutation.mutateAsync({ goalId: goal.id, amount: value });
    setContribution("");
  };

  return (
    <section
      className="border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card)] p-6 shadow-[var(--shadow)] animate-rise-up"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className="flex items-center gap-4">
        <DonutRing size={76} strokeWidth={8} segments={[{ fraction: pct, color }]} className="flex-shrink-0" />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <div className="text-sm font-semibold truncate text-[var(--text-primary)]">{goal.name}</div>
            {goal.is_complete && <CheckCircle2 size={14} className="text-[var(--accent)] flex-shrink-0" />}
          </div>
          {goal.target_date && (
            <div className="text-[11.5px] text-[var(--text-secondary)] mt-0.5">Até {formatDate(goal.target_date)}</div>
          )}
          <div className="text-[22px] font-semibold mt-2 tracking-[-.03em] text-[var(--text-primary)]">
            {Math.round(pct * 100)}%
          </div>
        </div>
      </div>
      <div className="mt-4.5 border-t border-[var(--border)] pt-3.5 flex justify-between text-[12.5px]">
        <div>
          <div className="text-[var(--text-secondary)]">Acumulado</div>
          <b className="font-semibold text-[var(--text-primary)]">{mask(formatBRLCompact(Number(goal.current_amount)))}</b>
        </div>
        <div className="text-right">
          <div className="text-[var(--text-secondary)]">Objetivo</div>
          <b className="font-semibold text-[var(--text-primary)]">{mask(formatBRLCompact(Number(goal.target_amount)))}</b>
        </div>
      </div>
      {status && <div className="mt-3 text-[11.5px]" style={{ color: status.color }}>{status.label}</div>}

      {!goal.is_complete && (
        <form onSubmit={handleContribute} className="flex items-center gap-1.5 mt-4 pt-4 border-t border-[var(--border)]">
          <input
            type="text"
            inputMode="decimal"
            value={contribution}
            onChange={(e) => setContribution(e.target.value)}
            placeholder="Aportar R$"
            className="flex-1 min-w-0 px-2.5 py-1.5 text-xs border border-[var(--border)] rounded-lg bg-[var(--surface-2)] text-[var(--text-primary)] focus:outline-none"
          />
          <button
            type="submit"
            disabled={contributeMutation.isPending}
            className="px-2.5 py-1.5 text-xs font-medium rounded-lg disabled:opacity-50"
            style={{ background: "var(--accent)", color: "#04120D" }}
          >
            Adicionar
          </button>
          <button
            onClick={() => { if (window.confirm(`Remover a meta "${goal.name}"?`)) deleteMutation.mutate(goal.id); }}
            type="button"
            className="text-[var(--text-muted)] hover:text-[var(--danger)]"
            aria-label={`Remover meta ${goal.name}`}
          >
            <Trash2 size={14} />
          </button>
        </form>
      )}
    </section>
  );
}

export function GoalsClient() {
  const mask = useMask();
  const { data: goals = [], isLoading } = useGoals();
  const { data: summary } = useFinanceSummary(currentMonth());
  const createMutation = useCreateGoal();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseBRNumber(targetAmount);
    if (!name.trim() || !value || value <= 0) return;
    await createMutation.mutateAsync({ name: name.trim(), target_amount: value, target_date: targetDate || undefined });
    setName(""); setTargetAmount(""); setTargetDate(""); setShowForm(false);
  };

  const activeGoals = goals.filter((g) => !g.is_complete);
  const surplus = Math.max(0, Number(summary?.net ?? 0));
  const remainingTotal = activeGoals.reduce((sum, g) => sum + Math.max(0, Number(g.target_amount) - Number(g.current_amount)), 0);
  const plan = remainingTotal > 0
    ? activeGoals
        .map((g, i) => {
          const remaining = Math.max(0, Number(g.target_amount) - Number(g.current_amount));
          const share = remaining / remainingTotal;
          return { goal: g, amount: surplus * share, color: g.color ?? CATEGORICAL[i % CATEGORICAL.length] };
        })
        .filter((p) => p.amount > 0)
    : [];

  return (
    <div className="p-[26px_30px_60px]">
      <div className="flex items-center justify-end mb-4">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 px-3.5 h-[34px] text-[12.5px] font-medium rounded-[11px]"
          style={{ background: "var(--accent)", color: "#04120D" }}
        >
          <Plus size={15} /> Nova meta
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="flex items-end gap-2 mb-5 p-4 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card-sm)] flex-wrap">
          <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Viagem, Reserva de emergência" className="flex-1 min-w-[160px]" />
          <Input label="Valor alvo (R$)" inputMode="decimal" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} placeholder="0,00" className="w-32" />
          <Input label="Data alvo (opcional)" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          <Button type="submit" size="sm" loading={createMutation.isPending}>Salvar</Button>
        </form>
      )}

      {!isLoading && goals.length === 0 ? (
        <EmptyState icon={Target} title="Nenhuma meta definida." description="Crie uma meta e acompanhe o progresso até o valor alvo." action={<Button onClick={() => setShowForm(true)}>Criar meta</Button>} />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-[18px]">
            {goals.map((goal, i) => <GoalCard key={goal.id} goal={goal} index={i} />)}
          </div>

          {plan.length > 0 && (
            <section className="mt-[18px] border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card)] p-6 shadow-[var(--shadow)] animate-rise-up" style={{ animationDelay: ".2s" }}>
              <div className="text-sm font-semibold text-[var(--text-primary)]">Plano de aportes sugerido</div>
              <div className="text-[12.5px] text-[var(--text-secondary)] mt-1">
                Distribuição automática da sobra mensal de {mask(formatBRLExact(surplus))}, proporcional ao quanto falta em cada meta
              </div>
              <div className="flex h-4 rounded-lg overflow-hidden mt-5 gap-[3px]">
                {plan.map((p) => (
                  <div key={p.goal.id} style={{ width: `${(p.amount / surplus) * 100}%`, background: p.color }} />
                ))}
              </div>
              <div className="flex gap-6 mt-4 flex-wrap text-[12.5px]">
                {plan.map((p) => (
                  <span key={p.goal.id} className="flex items-center gap-1.5">
                    <i className="w-2 h-2 rounded-[3px] block" style={{ background: p.color }} />
                    <span className="text-[var(--text-secondary)]">{p.goal.name}</span> · {mask(formatBRLExact(p.amount))}
                  </span>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
