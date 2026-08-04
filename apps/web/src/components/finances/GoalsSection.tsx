"use client";

import { useState } from "react";
import { Plus, Trash2, Target, CheckCircle2 } from "lucide-react";
import { useGoals, useCreateGoal, useDeleteGoal, useContributeToGoal } from "@/hooks/useGoals";
import { Goal } from "@/lib/goals-api";
import { formatBRL } from "@/components/charts/chartTheme";
import { EmptyState } from "@/components/ui/EmptyState";

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function GoalRow({ goal }: { goal: Goal }) {
  const [contribution, setContribution] = useState("");
  const contributeMutation = useContributeToGoal();
  const deleteMutation = useDeleteGoal();

  const pct = Math.min(Number(goal.pct_complete) * 100, 100);
  const targetDate = formatDate(goal.target_date);

  const handleContribute = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(contribution.replace(",", "."));
    if (!value) return;
    await contributeMutation.mutateAsync({ goalId: goal.id, amount: value });
    setContribution("");
  };

  return (
    <li>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="flex items-center gap-1.5 text-[var(--text-primary)] font-medium">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: goal.color ?? "#94A3B8" }} />
          {goal.name}
          {goal.is_complete && <CheckCircle2 size={13} className="text-[var(--accent)]" />}
          {targetDate && <span className="text-[var(--text-muted)] font-normal">até {targetDate}</span>}
        </span>
        <span className="flex items-center gap-2 font-mono text-[var(--text-secondary)]">
          {formatBRL(Number(goal.current_amount))} / {formatBRL(Number(goal.target_amount))}
          <button
            onClick={() => deleteMutation.mutate(goal.id)}
            className="text-[var(--text-muted)] hover:text-[var(--danger)]"
            aria-label={`Remover meta ${goal.name}`}
          >
            <Trash2 size={12} />
          </button>
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      {!goal.is_complete && (
        <form onSubmit={handleContribute} className="flex items-center gap-1.5 mt-1.5">
          <input
            type="text"
            inputMode="decimal"
            value={contribution}
            onChange={(e) => setContribution(e.target.value)}
            placeholder="Aportar R$"
            className="w-24 px-2 py-1 text-[11px] border border-[var(--border)] rounded-md bg-[var(--background)] text-[var(--text-primary)] font-mono"
          />
          <button
            type="submit"
            disabled={contributeMutation.isPending}
            className="px-2 py-1 text-[11px] text-[var(--navy)] dark:text-[var(--accent)] hover:underline disabled:opacity-50"
          >
            Adicionar
          </button>
        </form>
      )}
    </li>
  );
}

export function GoalsSection() {
  const { data: goals = [] } = useGoals();
  const createMutation = useCreateGoal();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(targetAmount.replace(",", "."));
    if (!name.trim() || !value || value <= 0) return;
    await createMutation.mutateAsync({
      name: name.trim(),
      target_amount: value,
      target_date: targetDate || undefined,
    });
    setName("");
    setTargetAmount("");
    setTargetDate("");
    setShowForm(false);
  };

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text-primary)]">
          <Target size={15} /> Metas de poupança
        </h3>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1 text-xs text-[var(--navy)] dark:text-[var(--accent)] hover:underline"
        >
          <Plus size={13} /> Nova meta
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="flex items-end gap-2 mb-4 pb-4 border-b border-[var(--border)] flex-wrap">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[10px] text-[var(--text-muted)] mb-1">Nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Viagem, Reserva de emergência"
              className="w-full px-2 py-1.5 text-xs border border-[var(--border)] rounded-md bg-[var(--background)] text-[var(--text-primary)]"
            />
          </div>
          <div>
            <label className="block text-[10px] text-[var(--text-muted)] mb-1">Valor alvo (R$)</label>
            <input
              type="text"
              inputMode="decimal"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              placeholder="0,00"
              className="w-28 px-2 py-1.5 text-xs border border-[var(--border)] rounded-md bg-[var(--background)] text-[var(--text-primary)] font-mono"
            />
          </div>
          <div>
            <label className="block text-[10px] text-[var(--text-muted)] mb-1">Data alvo (opcional)</label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="px-2 py-1.5 text-xs border border-[var(--border)] rounded-md bg-[var(--background)] text-[var(--text-primary)]"
            />
          </div>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="px-3 py-1.5 text-xs bg-[var(--navy)] text-white rounded-md hover:opacity-90 disabled:opacity-50"
          >
            Salvar
          </button>
        </form>
      )}

      {goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Nenhuma meta definida."
          description="Crie uma meta de poupança e acompanhe o progresso até o valor alvo."
        />
      ) : (
        <ul className="space-y-3">
          {goals.map((goal) => (
            <GoalRow key={goal.id} goal={goal} />
          ))}
        </ul>
      )}
    </div>
  );
}
