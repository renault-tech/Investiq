"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useCreateCard, useUpdateCard } from "@/hooks/useCards";
import { CreditCard } from "@/lib/cards-api";

interface CardModalProps {
  /** Presente = editando este cartão; ausente = cadastrando um novo. */
  card?: CreditCard;
  onClose: () => void;
}

export function CardModal({ card, onClose }: CardModalProps) {
  const isEditing = Boolean(card);
  const [name, setName] = useState(card?.name ?? "");
  const [brand, setBrand] = useState<NonNullable<CreditCard["brand"]>>(card?.brand ?? "visa");
  const [last4, setLast4] = useState(card?.last4 ?? "");
  const [creditLimit, setCreditLimit] = useState(card?.credit_limit != null ? String(card.credit_limit) : "");
  const [closingDay, setClosingDay] = useState(card?.closing_day != null ? String(card.closing_day) : "");
  const [dueDay, setDueDay] = useState(card?.due_day != null ? String(card.due_day) : "");
  const createMutation = useCreateCard();
  const updateMutation = useUpdateCard();
  const saving = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const input = {
      name: name.trim(),
      brand,
      last4: /^\d{4}$/.test(last4) ? last4 : undefined,
      credit_limit: creditLimit ? Number(creditLimit.replace(",", ".")) : undefined,
      closing_day: closingDay ? Number(closingDay) : undefined,
      due_day: dueDay ? Number(dueDay) : undefined,
    };
    if (isEditing && card) {
      await updateMutation.mutateAsync({ id: card.id, input });
    } else {
      await createMutation.mutateAsync(input);
    }
    onClose();
  };

  const inputClass =
    "w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--navy)]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-[var(--surface)] border border-[var(--border)] rounded-lg w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="card-modal-title"
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h2 id="card-modal-title" className="font-semibold text-[var(--text-primary)]">
            {isEditing ? "Editar cartão" : "Novo cartão"}
          </h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label htmlFor="card-name" className="block text-xs text-[var(--text-secondary)] mb-1">Apelido</label>
            <input id="card-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nubank, Itaú Click…" className={inputClass} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="card-brand" className="block text-xs text-[var(--text-secondary)] mb-1">Bandeira</label>
              <select id="card-brand" value={brand} onChange={(e) => setBrand(e.target.value as typeof brand)} className={inputClass}>
                <option value="visa">Visa</option>
                <option value="mastercard">Mastercard</option>
                <option value="elo">Elo</option>
                <option value="amex">Amex</option>
                <option value="other">Outra</option>
              </select>
            </div>
            <div>
              <label htmlFor="card-last4" className="block text-xs text-[var(--text-secondary)] mb-1">Últimos 4 dígitos</label>
              <input id="card-last4" value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder="1234" className={`${inputClass} font-mono`} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="card-limit" className="block text-xs text-[var(--text-secondary)] mb-1">Limite (R$)</label>
              <input id="card-limit" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} inputMode="decimal" className={`${inputClass} font-mono`} />
            </div>
            <div>
              <label htmlFor="card-closing" className="block text-xs text-[var(--text-secondary)] mb-1">Dia fechamento</label>
              <input id="card-closing" value={closingDay} onChange={(e) => setClosingDay(e.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" className={`${inputClass} font-mono`} />
            </div>
            <div>
              <label htmlFor="card-due" className="block text-xs text-[var(--text-secondary)] mb-1">Dia vencimento</label>
              <input id="card-due" value={dueDay} onChange={(e) => setDueDay(e.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" className={`${inputClass} font-mono`} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="px-4 py-2 text-sm bg-[var(--navy)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
