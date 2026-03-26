"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";
import { addPosition } from "@/lib/portfolio-api";

interface AddPositionModalProps {
  portfolioId: string;
  onClose: () => void;
}

export function AddPositionModal({ portfolioId, onClose }: AddPositionModalProps) {
  const queryClient = useQueryClient();
  const [ticker, setTicker] = useState("");
  const [broker, setBroker] = useState("");
  const [targetPct, setTargetPct] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const mutation = useMutation({
    mutationFn: () =>
      addPosition(portfolioId, {
        ticker: ticker.toUpperCase().trim(),
        broker: broker.trim() || undefined,
        target_weight: targetPct ? parseFloat(targetPct) / 100 : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio-summary", portfolioId] });
      toast.success(`Ativo ${ticker.toUpperCase()} adicionado!`);
      onClose();
    },
    onError: (err: unknown) => {
      const detail =
        err != null &&
        typeof err === "object" &&
        "response" in err &&
        (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      toast.error(detail || "Erro ao adicionar ativo. Tente novamente.");
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl w-[360px] p-5 animate-in fade-in slide-in-from-bottom-2 duration-150">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[13px] font-semibold text-white">Adicionar Ativo</h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-neutral-200">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label htmlFor="position-ticker" className="block text-[10px] text-[var(--text-muted)] mb-1">Ticker *</label>
            <input
              id="position-ticker"
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              maxLength={20}
              className="w-full px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 border border-[var(--border)] rounded-md text-[11px] text-[var(--text-primary)] outline-none focus:border-blue-500 font-mono"
              placeholder="Ex: PETR4"
            />
          </div>
          <div>
            <label htmlFor="position-broker" className="block text-[10px] text-[var(--text-muted)] mb-1">Corretora</label>
            <input
              id="position-broker"
              type="text"
              value={broker}
              onChange={(e) => setBroker(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 border border-[var(--border)] rounded-md text-[11px] text-[var(--text-primary)] outline-none focus:border-blue-500"
              placeholder="Ex: XP, Clear (opcional)"
            />
          </div>
          <div>
            <label htmlFor="position-target-weight" className="block text-[10px] text-[var(--text-muted)] mb-1">Peso Alvo %</label>
            <input
              id="position-target-weight"
              type="number"
              value={targetPct}
              onChange={(e) => setTargetPct(e.target.value)}
              min={0}
              max={100}
              step={0.1}
              className="w-full px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 border border-[var(--border)] rounded-md text-[11px] text-[var(--text-primary)] outline-none focus:border-blue-500"
              placeholder="Ex: 10 (opcional)"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-[11px] text-[var(--text-muted)] bg-slate-100 dark:bg-slate-800 border border-[var(--border)] rounded-md hover:bg-neutral-700"
          >
            Cancelar
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!ticker.trim() || mutation.isPending}
            className="px-3 py-1.5 text-[11px] text-white bg-[var(--navy)] rounded-md hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? "Adicionando..." : "Adicionar"}
          </button>
        </div>
      </div>
    </div>
  );
}
