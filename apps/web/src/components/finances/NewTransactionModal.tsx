"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useFinanceCategories, useCreateTransaction } from "@/hooks/useFinance";

interface Props {
  year: number;
  month: number;
  onClose: () => void;
}

export function NewFinanceTransactionModal({ year, month, onClose }: Props) {
  const { data: categories = [] } = useFinanceCategories();
  const mutation = useCreateTransaction(year, month);

  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const filtered = categories.filter((c) => c.category_type === type);

  const handleSubmit = () => {
    const num = parseFloat(amount);
    if (!description.trim() || isNaN(num) || num <= 0) {
      toast.error("Preencha descrição e valor.");
      return;
    }
    mutation.mutate(
      {
        transaction_type: type,
        amount: num,
        description: description.trim(),
        category_id: categoryId || null,
        transaction_date: new Date(date + "T12:00:00").toISOString(),
        notes: notes.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success("Transação registrada.");
          onClose();
        },
        onError: () => toast.error("Erro ao registrar transação."),
      }
    );
  };

  const inputCls =
    "w-full px-2.5 py-1.5 bg-[var(--background)] border border-[var(--border)] rounded-lg text-[11px] text-[var(--text-primary)] outline-none focus:border-[var(--navy)]";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl w-[400px] p-6 animate-in fade-in slide-in-from-bottom-3 duration-200">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">Nova Transação</h2>
          <button onClick={onClose} className="p-1 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <X size={15} />
          </button>
        </div>

        <div className="space-y-3">
          {/* Tipo */}
          <div className="flex rounded-lg overflow-hidden border border-[var(--border)]">
            {(["expense", "income"] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setType(t); setCategoryId(""); }}
                className={`flex-1 py-1.5 text-[11px] font-medium transition-colors ${
                  type === t
                    ? t === "expense"
                      ? "bg-red-500 text-white"
                      : "bg-[var(--accent)] text-white"
                    : "bg-[var(--background)] text-[var(--text-secondary)] hover:bg-[var(--border)]"
                }`}
              >
                {t === "expense" ? "Despesa" : "Receita"}
              </button>
            ))}
          </div>

          {/* Valor + Data */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-[var(--text-muted)] mb-1">Valor (R$) *</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min={0}
                step={0.01}
                placeholder="0,00"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-[10px] text-[var(--text-muted)] mb-1">Data *</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-[10px] text-[var(--text-muted)] mb-1">Descrição *</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Supermercado Extra"
              className={inputCls}
            />
          </div>

          {/* Categoria */}
          <div>
            <label className="block text-[10px] text-[var(--text-muted)] mb-1">Categoria</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={inputCls + " cursor-pointer"}
            >
              <option value="">Sem categoria</option>
              {filtered.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-[10px] text-[var(--text-muted)] mb-1">Notas</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Opcional"
              className={inputCls + " resize-none"}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-[11px] text-[var(--text-primary)] bg-[var(--background)] border border-[var(--border)] rounded-lg hover:bg-[var(--border)] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className={`px-4 py-1.5 text-[11px] text-white rounded-lg hover:opacity-80 transition-opacity disabled:opacity-50 ${
              type === "expense" ? "bg-red-500" : "bg-[var(--accent)]"
            }`}
          >
            {mutation.isPending ? "Salvando..." : "Registrar"}
          </button>
        </div>
      </div>
    </div>
  );
}
