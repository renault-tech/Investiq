"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";
import { createTransaction } from "@/lib/portfolio-api";
import type { PositionSummary } from "@/lib/portfolio-api";

interface NewTransactionModalProps {
  portfolioId: string;
  positions: PositionSummary[];
  defaultPositionId?: string;
  onClose: () => void;
}

const TRANSACTION_TYPES = [
  { value: "buy", label: "Compra" },
  { value: "sell", label: "Venda" },
  { value: "dividend", label: "Dividendo" },
  { value: "split", label: "Desdobramento" },
  { value: "bonus", label: "Bonificação" },
] as const;

export function NewTransactionModal({
  portfolioId,
  positions,
  defaultPositionId,
  onClose,
}: NewTransactionModalProps) {
  const queryClient = useQueryClient();
  const [positionId, setPositionId] = useState(defaultPositionId ?? "");
  const [txType, setTxType] = useState<string>("buy");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [fees, setFees] = useState("0");
  const [fxRate, setFxRate] = useState("1");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const mutation = useMutation({
    mutationFn: () =>
      createTransaction({
        position_id: positionId,
        transaction_type: txType as "buy" | "sell" | "dividend" | "split" | "bonus",
        quantity: parseFloat(quantity),
        unit_price: parseFloat(unitPrice),
        fees: parseFloat(fees) || 0,
        fx_rate: parseFloat(fxRate) > 0 ? parseFloat(fxRate) : 1,
        transaction_date: date, // YYYY-MM-DD direto do input; evita bug de UTC offset
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio-summary", portfolioId] });
      toast.success("Transação registrada!");
      onClose();
    },
    onError: (err: unknown) => {
      const detail =
        err != null &&
        typeof err === "object" &&
        "response" in err &&
        (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      toast.error(detail || "Erro ao registrar transação. Tente novamente.");
    },
  });

  const isValid = positionId && quantity && unitPrice && parseFloat(quantity) > 0 && parseFloat(unitPrice) > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-neutral-900 border border-neutral-700 rounded-xl w-[400px] p-5 animate-in fade-in slide-in-from-bottom-2 duration-150 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[13px] font-semibold text-white">Registrar Transação</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-200">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 space-y-3 pr-1">
          <div>
            <label htmlFor="tx-position" className="block text-[10px] text-neutral-400 mb-1">Ativo *</label>
            <select
              id="tx-position"
              value={positionId}
              onChange={(e) => setPositionId(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-neutral-800 border border-neutral-700 rounded-md text-[11px] text-neutral-100 outline-none focus:border-blue-500"
            >
              <option value="">Selecione um ativo</option>
              {positions.map((p) => (
                <option key={p.position_id} value={p.position_id}>
                  {p.ticker} {p.broker ? `(${p.broker})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="tx-type" className="block text-[10px] text-neutral-400 mb-1">Tipo *</label>
            <select
              id="tx-type"
              value={txType}
              onChange={(e) => setTxType(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-neutral-800 border border-neutral-700 rounded-md text-[11px] text-neutral-100 outline-none focus:border-blue-500"
            >
              {TRANSACTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="tx-quantity" className="block text-[10px] text-neutral-400 mb-1">Quantidade *</label>
              <input
                id="tx-quantity"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min={0}
                step="any"
                className="w-full px-2.5 py-1.5 bg-neutral-800 border border-neutral-700 rounded-md text-[11px] text-neutral-100 outline-none focus:border-blue-500"
                placeholder="100"
              />
            </div>
            <div>
              <label htmlFor="tx-price" className="block text-[10px] text-neutral-400 mb-1">Preço Unit. *</label>
              <input
                id="tx-price"
                type="number"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                min={0}
                step="any"
                className="w-full px-2.5 py-1.5 bg-neutral-800 border border-neutral-700 rounded-md text-[11px] text-neutral-100 outline-none focus:border-blue-500"
                placeholder="32.50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="tx-fees" className="block text-[10px] text-neutral-400 mb-1">Taxas</label>
              <input
                id="tx-fees"
                type="number"
                value={fees}
                onChange={(e) => setFees(e.target.value)}
                min={0}
                step="any"
                className="w-full px-2.5 py-1.5 bg-neutral-800 border border-neutral-700 rounded-md text-[11px] text-neutral-100 outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="tx-fx-rate" className="block text-[10px] text-neutral-400 mb-1">Câmbio</label>
              <input
                id="tx-fx-rate"
                type="number"
                value={fxRate}
                onChange={(e) => setFxRate(e.target.value)}
                min={0.0001}
                step="any"
                className="w-full px-2.5 py-1.5 bg-neutral-800 border border-neutral-700 rounded-md text-[11px] text-neutral-100 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="tx-date" className="block text-[10px] text-neutral-400 mb-1">Data *</label>
            <input
              id="tx-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-neutral-800 border border-neutral-700 rounded-md text-[11px] text-neutral-100 outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="tx-notes" className="block text-[10px] text-neutral-400 mb-1">Notas</label>
            <textarea
              id="tx-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-2.5 py-1.5 bg-neutral-800 border border-neutral-700 rounded-md text-[11px] text-neutral-100 outline-none focus:border-blue-500 resize-none"
              placeholder="Opcional"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-[11px] text-neutral-400 bg-neutral-800 border border-neutral-700 rounded-md hover:bg-neutral-700"
          >
            Cancelar
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!isValid || mutation.isPending}
            className="px-3 py-1.5 text-[11px] text-white bg-blue-600 rounded-md hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? "Registrando..." : "Registrar"}
          </button>
        </div>
      </div>
    </div>
  );
}
