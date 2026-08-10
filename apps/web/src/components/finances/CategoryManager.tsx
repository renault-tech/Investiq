"use client";

import { useState } from "react";
import { X, Plus } from "lucide-react";
import { FinanceCategory } from "@/lib/finance-api";
import { useCreateCategory, useDeleteCategory } from "@/hooks/useFinance";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";

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
    <Modal title="Categorias" onClose={onClose}>
      <form onSubmit={handleCreate} className="space-y-3 pb-4 mb-4 border-b border-[var(--border)]">
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nova categoria"
            maxLength={100}
            className="flex-1"
            aria-label="Nome da nova categoria"
          />
          <Select
            value={type}
            onChange={(e) => setType(e.target.value as "income" | "expense")}
            className="w-auto"
            aria-label="Tipo da categoria"
          >
            <option value="expense">Despesa</option>
            <option value="income">Receita</option>
          </Select>
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
          <Button type="submit" size="sm" disabled={!name.trim()} loading={createMutation.isPending} className="ml-auto">
            <Plus size={14} /> Criar
          </Button>
        </div>
      </form>

      <div className="space-y-4">
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
    </Modal>
  );
}
