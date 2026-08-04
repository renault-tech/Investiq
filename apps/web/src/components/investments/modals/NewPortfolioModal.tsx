"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createPortfolio } from "@/lib/portfolio-api";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface NewPortfolioModalProps {
  onClose: () => void;
}

const fieldClass =
  "w-full px-2.5 py-1.5 bg-[var(--background)] border border-[var(--border)] rounded-md text-[11px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]";

export function NewPortfolioModal({ onClose }: NewPortfolioModalProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState("BRL");

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
    <Modal
      title="Novo Portfólio"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={() => mutation.mutate()}
            disabled={!name.trim() || mutation.isPending}
            loading={mutation.isPending}
          >
            {mutation.isPending ? "Criando..." : "Criar Portfólio"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label htmlFor="portfolio-name" className="block text-[10px] text-[var(--text-muted)] mb-1">Nome *</label>
          <input
            id="portfolio-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={fieldClass}
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
            className={`${fieldClass} resize-none`}
            placeholder="Opcional"
          />
        </div>
        <div>
          <label htmlFor="portfolio-currency" className="block text-[10px] text-[var(--text-muted)] mb-1">Moeda</label>
          <select
            id="portfolio-currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className={fieldClass}
          >
            <option value="BRL">BRL — Real</option>
            <option value="USD">USD — Dólar</option>
            <option value="EUR">EUR — Euro</option>
          </select>
        </div>
      </div>
    </Modal>
  );
}
