"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";
import { addPosition, createTransaction } from "@/lib/portfolio-api";

interface AddPositionModalProps {
  portfolioId: string;
  onClose: () => void;
}

export function AddPositionModal({ portfolioId, onClose }: AddPositionModalProps) {
  const queryClient = useQueryClient();
  const [ticker, setTicker] = useState("");
  const [broker, setBroker] = useState("");
  const [targetPct, setTargetPct] = useState("");

  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const mutation = useMutation({
    mutationFn: async () => {
      // 1. Cria a posição
      const position = await addPosition(portfolioId, {
        ticker: ticker.toUpperCase().trim(),
        broker: broker.trim() || undefined,
        target_weight: targetPct ? parseFloat(targetPct) / 100 : undefined,
      }) as { id: string };

      // 2. Registra transação inicial se qty+preço informados
      const numQty = parseFloat(quantity);
      const numPrice = parseFloat(price);
      if (!isNaN(numQty) && !isNaN(numPrice) && numQty > 0) {
        await createTransaction({
          position_id: position.id,
          transaction_type: "buy",
          quantity: numQty,
          unit_price: numPrice,
          fees: 0,
          fx_rate: 1,
          transaction_date: new Date().toISOString().split("T")[0],
        });
      }

      return ticker.toUpperCase().trim();
    },
    onSuccess: (tickerName) => {
      queryClient.invalidateQueries({ queryKey: ["portfolio-summary", portfolioId] });
      toast.success(`${tickerName} adicionado ao portfólio!`);
      onClose();
    },
    onError: (err: unknown) => {
      // Sempre invalida — a posição pode ter sido criada antes da transação falhar
      queryClient.invalidateQueries({ queryKey: ["portfolio-summary", portfolioId] });
      const detail =
        err != null &&
        typeof err === "object" &&
        "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      toast.error(detail || "Erro ao adicionar ativo. Verifique se o ticker é válido.");
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
          {/* Main Ticker Field */}
          <div>
            <label htmlFor="position-ticker" className="block text-[10px] text-[var(--text-muted)] mb-1">Ticker <span className="text-red-400">*</span></label>
            <input
              id="position-ticker"
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              maxLength={20}
              className="w-full px-2.5 py-1.5 bg-neutral-100 dark:bg-black/40 border border-neutral-300 dark:border-neutral-700/50 rounded-md text-[11px] text-black dark:text-white outline-none focus:border-blue-500 font-mono"
              placeholder="Ex: PETR4"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="pos-qty" className="block text-[10px] text-[var(--text-muted)] mb-1">Quantidade</label>
              <input
                id="pos-qty"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min={0}
                step={1}
                className="w-full px-2.5 py-1.5 bg-neutral-100 dark:bg-black/40 border border-neutral-300 dark:border-neutral-700/50 rounded-md text-[11px] text-black dark:text-white outline-none focus:border-blue-500"
                placeholder="Opcional"
              />
            </div>
            <div>
              <label htmlFor="pos-price" className="block text-[10px] text-[var(--text-muted)] mb-1">Preço Atual</label>
              <input
                id="pos-price"
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                min={0}
                step={0.01}
                className="w-full px-2.5 py-1.5 bg-neutral-100 dark:bg-black/40 border border-neutral-300 dark:border-neutral-700/50 rounded-md text-[11px] text-black dark:text-white outline-none focus:border-blue-500"
                placeholder="R$ Opcional"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="position-target-weight" className="block text-[10px] text-[var(--text-muted)] mb-1">Alvo do Portfólio %</label>
              <input
                id="position-target-weight"
                type="number"
                value={targetPct}
                onChange={(e) => setTargetPct(e.target.value)}
                min={0}
                max={100}
                step={0.1}
                className="w-full px-2.5 py-1.5 bg-neutral-100 dark:bg-black/40 border border-neutral-300 dark:border-neutral-700/50 rounded-md text-[11px] text-black dark:text-white outline-none focus:border-blue-500"
                placeholder="Ex: 5%"
              />
            </div>
            <div>
              <label htmlFor="position-broker" className="block text-[10px] text-[var(--text-muted)] mb-1">Corretora</label>
              <input
                id="position-broker"
                type="text"
                value={broker}
                onChange={(e) => setBroker(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-neutral-100 dark:bg-black/40 border border-neutral-300 dark:border-neutral-700/50 rounded-md text-[11px] text-black dark:text-white outline-none focus:border-blue-500"
                placeholder="Ex: NuInvest"
              />
            </div>
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
