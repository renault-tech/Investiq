"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { addPosition, createTransaction } from "@/lib/portfolio-api";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { parseBRNumber, parseBRQuantity, sanitizeNumericInput } from "@/lib/number-format";

interface AddPositionModalProps {
  portfolioId: string;
  onClose: () => void;
}

const fieldClass =
  "w-full px-2.5 py-1.5 bg-[var(--background)] border border-[var(--border)] rounded-md text-[11px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] font-mono";

/** Ticker sintético a partir do nome — reserva/caixa não tem um código de
 * mercado de verdade, mas o backend ainda usa "ticker" como identificador
 * único do ativo. */
function slugifyForTicker(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `CX-${slug}`.slice(0, 20);
}

export function AddPositionModal({ portfolioId, onClose }: AddPositionModalProps) {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<"market" | "cash">("market");
  const [ticker, setTicker] = useState("");
  const [cashName, setCashName] = useState("");
  const [broker, setBroker] = useState("");
  const [targetPct, setTargetPct] = useState("");

  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [cashAmount, setCashAmount] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const isCash = kind === "cash";
      const displayName = isCash ? cashName.trim() : ticker.toUpperCase().trim();
      const resolvedTicker = isCash ? slugifyForTicker(cashName) : ticker.toUpperCase().trim();

      // 1. Cria a posição
      const position = await addPosition(portfolioId, {
        ticker: resolvedTicker,
        broker: broker.trim() || undefined,
        target_weight: parseBRNumber(targetPct) != null ? parseBRNumber(targetPct)! / 100 : undefined,
        asset_type: isCash ? "cash" : undefined,
        name: isCash ? displayName : undefined,
      }) as { id: string };

      // 2. Registra transação inicial — caixa/reserva sempre a R$1,00 por
      // "unidade" (a quantidade já É o valor guardado); ativo de mercado só
      // se qty+preço informados.
      const numQty = isCash ? parseBRNumber(cashAmount) : parseBRQuantity(quantity);
      const numPrice = isCash ? 1 : parseBRNumber(price);
      if (numQty != null && numPrice != null && numQty > 0) {
        await createTransaction({
          position_id: position.id,
          transaction_type: "buy",
          quantity: numQty,
          unit_price: numPrice,
          fees: 0,
          // Sem fx_rate: o backend resolve pela moeda do ativo. Fixar 1 aqui
          // gravava o custo de um ativo em dólar como se fosse em reais.
          transaction_date: new Date().toISOString().split("T")[0],
        });
      }

      return displayName;
    },
    onSuccess: (tickerName) => {
      queryClient.invalidateQueries({ queryKey: ["portfolio-summary", portfolioId] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-look-through", portfolioId] });
      toast.success(`${tickerName} adicionado à carteira!`);
      onClose();
    },
    onError: (err: unknown) => {
      // Sempre invalida — a posição pode ter sido criada antes da transação falhar
      queryClient.invalidateQueries({ queryKey: ["portfolio-summary", portfolioId] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-look-through", portfolioId] });
      const raw =
        err != null &&
        typeof err === "object" &&
        "response" in err
          ? (err as { response?: { data?: { detail?: unknown } } }).response?.data?.detail
          : undefined;
      // Num 422 de validação do FastAPI, `detail` é uma lista de objetos
      // {msg,...} — passar isso direto pro toast quebra a página inteira
      // (React não renderiza objeto/array como filho).
      const detail =
        typeof raw === "string"
          ? raw
          : Array.isArray(raw) && raw.length > 0 && raw[0] && typeof raw[0] === "object" && "msg" in raw[0]
          ? String((raw[0] as { msg: unknown }).msg)
          : undefined;
      toast.error(detail || "Erro ao adicionar ativo. Verifique se o ticker é válido.");
    },
  });

  return (
    <Modal
      title="Adicionar Ativo"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={() => mutation.mutate()}
            disabled={!(kind === "cash" ? cashName.trim() : ticker.trim()) || mutation.isPending}
            loading={mutation.isPending}
          >
            {mutation.isPending ? "Adicionando..." : "Adicionar"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <span className="block text-[10px] text-[var(--text-muted)] mb-1">Tipo</span>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setKind("market")}
              className={`px-2.5 py-1.5 rounded-md text-[11px] border transition-colors ${
                kind === "market"
                  ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10"
                  : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]"
              }`}
            >
              Ativo de mercado
            </button>
            <button
              type="button"
              onClick={() => setKind("cash")}
              className={`px-2.5 py-1.5 rounded-md text-[11px] border transition-colors ${
                kind === "cash"
                  ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10"
                  : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]"
              }`}
            >
              Caixa / reserva
            </button>
          </div>
        </div>

        {kind === "market" ? (
          <>
            <div>
              <label htmlFor="position-ticker" className="block text-[10px] text-[var(--text-muted)] mb-1">
                Ticker <span className="text-[var(--danger)]">*</span>
              </label>
              <input
                id="position-ticker"
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                maxLength={20}
                className={fieldClass}
                placeholder="Ex: PETR4"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="pos-qty" className="block text-[10px] text-[var(--text-muted)] mb-1">Quantidade</label>
                <input
                  id="pos-qty"
                  type="text"
                  inputMode="decimal"
                  value={quantity}
                  onChange={(e) => setQuantity(sanitizeNumericInput(e.target.value))}
                  className={fieldClass}
                  placeholder="Opcional"
                />
              </div>
              <div>
                <label htmlFor="pos-price" className="block text-[10px] text-[var(--text-muted)] mb-1">Preço Atual</label>
                <input
                  id="pos-price"
                  type="text"
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setPrice(sanitizeNumericInput(e.target.value))}
                  className={fieldClass}
                  placeholder="R$ Opcional"
                />
              </div>
            </div>
          </>
        ) : (
          <>
            <div>
              <label htmlFor="position-cash-name" className="block text-[10px] text-[var(--text-muted)] mb-1">
                Nome <span className="text-[var(--danger)]">*</span>
              </label>
              <input
                id="position-cash-name"
                type="text"
                value={cashName}
                onChange={(e) => setCashName(e.target.value)}
                maxLength={60}
                className={fieldClass}
                placeholder="Ex: Cofrinho Mercado Pago"
              />
            </div>

            <div>
              <label htmlFor="pos-cash-amount" className="block text-[10px] text-[var(--text-muted)] mb-1">Valor guardado</label>
              <input
                id="pos-cash-amount"
                type="text"
                inputMode="decimal"
                value={cashAmount}
                onChange={(e) => setCashAmount(sanitizeNumericInput(e.target.value))}
                className={fieldClass}
                placeholder="R$ Opcional"
              />
              <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                Sem cotação de mercado — o valor guardado é o próprio saldo, sempre a R$ 1,00 por unidade.
              </p>
            </div>
          </>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="position-target-weight" className="block text-[10px] text-[var(--text-muted)] mb-1">Alvo na carteira %</label>
            <input
              id="position-target-weight"
              type="text"
              inputMode="decimal"
              value={targetPct}
              onChange={(e) => setTargetPct(sanitizeNumericInput(e.target.value))}
              max={100}
              className={fieldClass}
              placeholder="Ex: 5%"
            />
          </div>
          <div>
            <label htmlFor="position-broker" className="block text-[10px] text-[var(--text-muted)] mb-1">
              {kind === "cash" ? "Instituição" : "Corretora"}
            </label>
            <input
              id="position-broker"
              type="text"
              value={broker}
              onChange={(e) => setBroker(e.target.value)}
              className={fieldClass}
              placeholder={kind === "cash" ? "Ex: Mercado Pago" : "Ex: NuInvest"}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
