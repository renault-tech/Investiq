"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createTransaction } from "@/lib/portfolio-api";
import type { PositionSummary } from "@/lib/portfolio-api";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

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

const fieldClass =
  "w-full px-2.5 py-1.5 bg-[var(--background)] border border-[var(--border)] rounded-md text-[11px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]";

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
      queryClient.invalidateQueries({ queryKey: ["portfolio-look-through", portfolioId] });
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
    <Modal
      title="Registrar Transação"
      onClose={onClose}
      maxWidth="lg"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={() => mutation.mutate()}
            disabled={!isValid || mutation.isPending}
            loading={mutation.isPending}
          >
            {mutation.isPending ? "Registrando..." : "Registrar"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label htmlFor="tx-position" className="block text-[10px] text-[var(--text-muted)] mb-1">Ativo *</label>
          <select
            id="tx-position"
            value={positionId}
            onChange={(e) => setPositionId(e.target.value)}
            className={fieldClass}
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
          <label htmlFor="tx-type" className="block text-[10px] text-[var(--text-muted)] mb-1">Tipo *</label>
          <select
            id="tx-type"
            value={txType}
            onChange={(e) => setTxType(e.target.value)}
            className={fieldClass}
          >
            {TRANSACTION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="tx-quantity" className="block text-[10px] text-[var(--text-muted)] mb-1">Quantidade *</label>
            <input
              id="tx-quantity"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min={0}
              step="any"
              className={fieldClass}
              placeholder="100"
            />
          </div>
          <div>
            <label htmlFor="tx-price" className="block text-[10px] text-[var(--text-muted)] mb-1">Preço Unit. *</label>
            <input
              id="tx-price"
              type="number"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              min={0}
              step="any"
              className={fieldClass}
              placeholder="32.50"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="tx-fees" className="block text-[10px] text-[var(--text-muted)] mb-1">Taxas</label>
            <input
              id="tx-fees"
              type="number"
              value={fees}
              onChange={(e) => setFees(e.target.value)}
              min={0}
              step="any"
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="tx-fx-rate" className="block text-[10px] text-[var(--text-muted)] mb-1">Câmbio</label>
            <input
              id="tx-fx-rate"
              type="number"
              value={fxRate}
              onChange={(e) => setFxRate(e.target.value)}
              min={0.0001}
              step="any"
              className={fieldClass}
            />
          </div>
        </div>

        <div>
          <label htmlFor="tx-date" className="block text-[10px] text-[var(--text-muted)] mb-1">Data *</label>
          <input
            id="tx-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={fieldClass}
          />
        </div>

        <div>
          <label htmlFor="tx-notes" className="block text-[10px] text-[var(--text-muted)] mb-1">Notas</label>
          <textarea
            id="tx-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className={`${fieldClass} resize-none`}
            placeholder="Opcional"
          />
        </div>
      </div>
    </Modal>
  );
}
