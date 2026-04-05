"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";
import { createPortfolio } from "@/lib/portfolio-api";

interface NewPortfolioModalProps {
  onClose: () => void;
}

export function NewPortfolioModal({ onClose }: NewPortfolioModalProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState("BRL");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const mutation = useMutation({
    mutationFn: () => createPortfolio({ name, description: description || undefined, currency }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      toast.success("Portfólio criado!");
      onClose();
    },
    onError: () => toast.error("Erro ao criar portfólio"),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl w-[360px] p-5 animate-in fade-in slide-in-from-bottom-2 duration-150 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">Novo Portfólio</h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-neutral-500 dark:hover:text-neutral-200">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label htmlFor="portfolio-name" className="block text-[10px] text-[var(--text-muted)] mb-1">Nome *</label>
            <input
              id="portfolio-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-[var(--background)] border border-[var(--border)] rounded-md text-[11px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              placeholder="Ex: Longo Prazo"
            />
          </div>
          <div>
            <label htmlFor="portfolio-desc" className="block text-[10px] text-[var(--text-muted)] mb-1">Descrição</label>
            <textarea
              id="portfolio-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-2.5 py-1.5 bg-[var(--background)] border border-[var(--border)] rounded-md text-[11px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] resize-none"
              placeholder="Opcional"
            />
          </div>
          <div>
            <label htmlFor="portfolio-currency" className="block text-[10px] text-[var(--text-muted)] mb-1">Moeda</label>
            <select
              id="portfolio-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-[var(--background)] border border-[var(--border)] rounded-md text-[11px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
            >
              <option value="BRL">BRL — Real</option>
              <option value="USD">USD — Dólar</option>
              <option value="EUR">EUR — Euro</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-[11px] text-[var(--text-primary)] bg-[var(--background)] border border-[var(--border)] rounded-md hover:bg-[var(--border-strong)] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!name.trim() || mutation.isPending}
            className="px-3 py-1.5 text-[11px] text-white bg-[var(--navy)] rounded-md hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? "Criando..." : "Criar Portfólio"}
          </button>
        </div>
      </div>
    </div>
  );
}
