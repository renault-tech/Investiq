"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createTransaction } from "@/lib/portfolio-api";
import type { PositionSummary } from "@/lib/portfolio-api";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { parseBRNumber, parseBRNumberOr, parseBRQuantityOr, sanitizeNumericInput } from "@/lib/number-format";

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
  const [fxRate, setFxRate] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      createTransaction({
        position_id: positionId,
        transaction_type: txType as "buy" | "sell" | "dividend" | "split" | "bonus",
        quantity: parseBRQuantityOr(quantity, 0),
        unit_price: parseBRNumberOr(unitPrice, 0),
        fees: parseBRNumberOr(fees, 0),
        // Vazio = o backend usa o câmbio do dia da moeda do ativo. Mandar 1
        // por padrão gravava o custo de ativo em dólar como se fosse real.
        fx_rate: parseBRNumber(fxRate) && parseBRNumber(fxRate)! > 0 ? parseBRNumber(fxRate)! : undefined,
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
      const raw =
        err != null &&
        typeof err === "object" &&
        "response" in err &&
        (err as { response?: { data?: { detail?: unknown } } }).response?.data?.detail;
      // Num 422 de validação do FastAPI, `detail` é uma lista de objetos
      // {msg,...} — passar isso direto pro toast quebra a página inteira
      // (React não renderiza objeto/array como filho).
      const detail =
        typeof raw === "string"
          ? raw
          : Array.isArray(raw) && raw.length > 0 && raw[0] && typeof raw[0] === "object" && "msg" in raw[0]
          ? String((raw[0] as { msg: unknown }).msg)
          : undefined;
      toast.error(detail || "Erro ao registrar transação. Tente novamente.");
    },
  });

  const isValid =
    !!positionId && parseBRQuantityOr(quantity, 0) > 0 && parseBRNumberOr(unitPrice, 0) > 0;

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
              type="text"
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(sanitizeNumericInput(e.target.value))}
              className={fieldClass}
              placeholder="100"
            />
          </div>
          <div>
            <label htmlFor="tx-price" className="block text-[10px] text-[var(--text-muted)] mb-1">Preço Unit. *</label>
            <input
              id="tx-price"
              type="text"
              inputMode="decimal"
              value={unitPrice}
              onChange={(e) => setUnitPrice(sanitizeNumericInput(e.target.value))}
              className={fieldClass}
              placeholder="32,50"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="tx-fees" className="block text-[10px] text-[var(--text-muted)] mb-1">Taxas</label>
            <input
              id="tx-fees"
              type="text"
              inputMode="decimal"
              value={fees}
              onChange={(e) => setFees(sanitizeNumericInput(e.target.value))}
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="tx-fx-rate" className="block text-[10px] text-[var(--text-muted)] mb-1">Câmbio</label>
            <input
              id="tx-fx-rate"
              type="text"
              inputMode="decimal"
              value={fxRate}
              onChange={(e) => setFxRate(sanitizeNumericInput(e.target.value))}
              className={fieldClass}
              placeholder="Cotação do dia"
              title="Deixe em branco para usar a cotação do dia da moeda do ativo"
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
