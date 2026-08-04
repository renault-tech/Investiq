"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { FinanceCategory, FinanceTransaction } from "@/lib/finance-api";
import { useCreateTransaction, useUpdateTransaction } from "@/hooks/useFinance";

const RECURRENCE_OPTIONS = [
  { value: "", label: "Não se repete" },
  { value: "FREQ=WEEKLY", label: "Semanal" },
  { value: "FREQ=MONTHLY", label: "Mensal" },
  { value: "FREQ=YEARLY", label: "Anual" },
];

interface TransactionModalProps {
  categories: FinanceCategory[];
  editing?: FinanceTransaction;
  onClose: () => void;
}

export function TransactionModal({ categories, editing, onClose }: TransactionModalProps) {
  const [type, setType] = useState<"income" | "expense">(
    editing?.transaction_type === "income" ? "income" : "expense"
  );
  const [amount, setAmount] = useState(editing ? String(editing.amount) : "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [categoryId, setCategoryId] = useState(editing?.category_id ?? "");
  const [date, setDate] = useState(
    editing ? editing.transaction_date.slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  const [recurrence, setRecurrence] = useState(editing?.recurrence_rule ?? "");
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateTransaction();
  const updateMutation = useUpdateTransaction();
  const pending = createMutation.isPending || updateMutation.isPending;

  const filteredCategories = categories.filter(
    (c) => c.category_type === type && c.is_active
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Number(amount.replace(",", "."));
    if (!parsed || parsed <= 0) {
      setError("Informe um valor válido maior que zero.");
      return;
    }
    setError(null);

    const payload = {
      transaction_type: type,
      amount: parsed,
      description: description || undefined,
      category_id: categoryId || undefined,
      transaction_date: `${date}T12:00:00Z`,
      recurrence_rule: recurrence || undefined,
    };

    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, input: payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--surface)] border border-[var(--border)] rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="transaction-modal-title"
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h2 id="transaction-modal-title" className="font-semibold text-[var(--text-primary)]">
            {editing ? "Editar transação" : "Nova transação"}
          </h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
            {([["expense", "Despesa"], ["income", "Receita"]] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => { setType(value); setCategoryId(""); }}
                className={`flex-1 py-2 text-sm transition-colors ${
                  type === value
                    ? value === "expense"
                      ? "bg-[var(--danger)] text-white"
                      : "bg-[var(--accent)] text-white"
                    : "text-[var(--text-secondary)] hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div>
            <label htmlFor="txn-amount" className="block text-xs text-[var(--text-secondary)] mb-1">Valor (R$)</label>
            <input
              id="txn-amount"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--text-primary)] font-mono focus:outline-none focus:ring-1 focus:ring-[var(--navy)]"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="txn-description" className="block text-xs text-[var(--text-secondary)] mb-1">Descrição</label>
            <input
              id="txn-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={255}
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--navy)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="txn-category" className="block text-xs text-[var(--text-secondary)] mb-1">Categoria</label>
              <select
                id="txn-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--navy)]"
              >
                <option value="">Sem categoria</option>
                {filteredCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="txn-date" className="block text-xs text-[var(--text-secondary)] mb-1">Data</label>
              <input
                id="txn-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--navy)]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="txn-recurrence" className="block text-xs text-[var(--text-secondary)] mb-1">Recorrência</label>
            <select
              id="txn-recurrence"
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--navy)]"
            >
              {RECURRENCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-xs text-[var(--danger)]">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="px-4 py-2 text-sm bg-[var(--navy)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
