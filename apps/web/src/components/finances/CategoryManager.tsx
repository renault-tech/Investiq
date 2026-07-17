"use client";

import { useState } from "react";
import { X, Plus } from "lucide-react";
import { FinanceCategory } from "@/lib/finance-api";
import { useCreateCategory, useDeleteCategory } from "@/hooks/useFinance";

const COLOR_CHOICES = ["#2563EB", "#059669", "#7C3AED", "#D97706", "#0891B2", "#DB2777", "#64748B", "#EF4444"];

interface CategoryManagerProps {
  categories: FinanceCategory[];
  onClose: () => void;
}

export function CategoryManager({ categories, onClose }: CategoryManagerProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [color, setColor] = useState(COLOR_CHOICES[0]);

  const createMutation = useCreateCategory();
  const deleteMutation = useDeleteCategory();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await createMutation.mutateAsync({ name: name.trim(), category_type: type, color });
    setName("");
  };

  const active = categories.filter((c) => c.is_active);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-[var(--surface)] border border-[var(--border)] rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="category-manager-title"
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h2 id="category-manager-title" className="font-semibold text-[var(--text-primary)]">Categorias</h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleCreate} className="p-4 border-b border-[var(--border)] space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nova categoria"
              maxLength={100}
              className="flex-1 px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--navy)]"
            />
            <select
              value={type}
              onChange={(e) => setType(e.target.value as "income" | "expense")}
              className="px-2 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--text-primary)]"
              aria-label="Tipo da categoria"
            >
              <option value="expense">Despesa</option>
              <option value="income">Receita</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5" role="radiogroup" aria-label="Cor da categoria">
              {COLOR_CHOICES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  role="radio"
                  aria-checked={color === c}
                  aria-label={`Cor ${c}`}
                  className={`w-6 h-6 rounded-full border-2 ${color === c ? "border-[var(--text-primary)]" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <button
              type="submit"
              disabled={createMutation.isPending || !name.trim()}
              className="ml-auto flex items-center gap-1 px-3 py-1.5 text-sm bg-[var(--navy)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              <Plus size={14} /> Criar
            </button>
          </div>
        </form>

        <div className="p-4 space-y-4">
          {(["expense", "income"] as const).map((catType) => (
            <div key={catType}>
              <p className="text-xs text-[var(--text-muted)] mb-2">
                {catType === "expense" ? "Despesas" : "Receitas"}
              </p>
              <ul className="space-y-1">
                {active.filter((c) => c.category_type === catType).map((c) => (
                  <li key={c.id} className="flex items-center gap-2 text-sm py-1">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.color ?? "#94A3B8" }} />
                    <span className="text-[var(--text-primary)]">{c.name}</span>
                    <button
                      onClick={() => deleteMutation.mutate(c.id)}
                      className="ml-auto p-1 text-[var(--text-muted)] hover:text-[var(--danger)]"
                      aria-label={`Desativar ${c.name}`}
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
