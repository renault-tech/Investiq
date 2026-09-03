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

type InvestmentKind = "market" | "fixed_income" | "cash";

const KIND_OPTIONS: { value: InvestmentKind; label: string }[] = [
  { value: "market", label: "Renda variável (ação, FII, ETF, cripto...)" },
  { value: "fixed_income", label: "Renda fixa (CDB, Tesouro, LCI/LCA...)" },
  { value: "cash", label: "Reserva / caixa (cofrinho, saldo em conta)" },
];

export function AddPositionModal({ portfolioId, onClose }: AddPositionModalProps) {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<InvestmentKind>("market");
  const [ticker, setTicker] = useState("");
  const [cashName, setCashName] = useState("");
  const [fixedIncomeName, setFixedIncomeName] = useState("");
  const [fixedIncomeRate, setFixedIncomeRate] = useState("");
  const [fixedIncomeMaturity, setFixedIncomeMaturity] = useState("");
  const [broker, setBroker] = useState("");
  const [targetPct, setTargetPct] = useState("");

  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [cashAmount, setCashAmount] = useState("");
  const [fixedIncomeAmount, setFixedIncomeAmount] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const isCash = kind === "cash";
      const isFixedIncome = kind === "fixed_income";
      // Renda fixa não tem cotação de mercado — mesmo golpe do caixa/reserva
      // (quantidade = valor investido, preço travado em 1). Taxa/vencimento
      // não têm campo próprio no Asset (evita migração pra um v1); entram
      // como texto no nome, onde aparecem em qualquer lista/gráfico que já
      // mostra o nome do ativo.
      const rawName = isCash ? cashName : isFixedIncome ? fixedIncomeName : "";
      const fixedIncomeSuffix = isFixedIncome
        ? [fixedIncomeRate.trim(), fixedIncomeMaturity ? `venc. ${new Date(fixedIncomeMaturity + "T12:00:00").toLocaleDateString("pt-BR")}` : ""]
            .filter(Boolean)
            .join(" · ")
        : "";
      const displayName =
        kind === "market"
          ? ticker.toUpperCase().trim()
          : fixedIncomeSuffix
            ? `${rawName.trim()} (${fixedIncomeSuffix})`
            : rawName.trim();
      const resolvedTicker = kind === "market" ? ticker.toUpperCase().trim() : slugifyForTicker(rawName);

      // 1. Cria a posição
      const position = await addPosition(portfolioId, {
        ticker: resolvedTicker,
        broker: broker.trim() || undefined,
        target_weight: parseBRNumber(targetPct) != null ? parseBRNumber(targetPct)! / 100 : undefined,
        asset_type: isCash ? "cash" : isFixedIncome ? "fixed_income_br" : undefined,
        name: kind !== "market" ? displayName : undefined,
      }) as { id: string };

      // 2. Registra transação inicial — caixa/reserva e renda fixa sempre a
      // R$1,00 por "unidade" (a quantidade já É o valor investido/guardado);
      // ativo de mercado só se qty+preço informados.
      const numQty = isCash ? parseBRNumber(cashAmount) : isFixedIncome ? parseBRNumber(fixedIncomeAmount) : parseBRQuantity(quantity);
      const numPrice = isCash || isFixedIncome ? 1 : parseBRNumber(price);
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
            disabled={
              !(kind === "market" ? ticker.trim() : kind === "cash" ? cashName.trim() : fixedIncomeName.trim()) ||
              mutation.isPending
            }
            loading={mutation.isPending}
          >
            {mutation.isPending ? "Adicionando..." : "Adicionar"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label htmlFor="position-kind" className="block text-[10px] text-[var(--text-muted)] mb-1">
            Tipo de investimento
          </label>
          <select
            id="position-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as InvestmentKind)}
            className={fieldClass}
          >
            {KIND_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
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
        ) : kind === "fixed_income" ? (
          <>
            <div>
              <label htmlFor="position-fi-name" className="block text-[10px] text-[var(--text-muted)] mb-1">
                Nome do título <span className="text-[var(--danger)]">*</span>
              </label>
              <input
                id="position-fi-name"
                type="text"
                value={fixedIncomeName}
                onChange={(e) => setFixedIncomeName(e.target.value)}
                maxLength={60}
                className={fieldClass}
                placeholder="Ex: CDB Banco X, Tesouro IPCA+ 2029"
              />
            </div>

            <div>
              <label htmlFor="pos-fi-amount" className="block text-[10px] text-[var(--text-muted)] mb-1">Valor investido</label>
              <input
                id="pos-fi-amount"
                type="text"
                inputMode="decimal"
                value={fixedIncomeAmount}
                onChange={(e) => setFixedIncomeAmount(sanitizeNumericInput(e.target.value))}
                className={fieldClass}
                placeholder="R$ Opcional"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="pos-fi-rate" className="block text-[10px] text-[var(--text-muted)] mb-1">Taxa / indexador</label>
                <input
                  id="pos-fi-rate"
                  type="text"
                  value={fixedIncomeRate}
                  onChange={(e) => setFixedIncomeRate(e.target.value)}
                  maxLength={40}
                  className={fieldClass}
                  placeholder="Ex: CDI + 2%, IPCA + 6%"
                />
              </div>
              <div>
                <label htmlFor="pos-fi-maturity" className="block text-[10px] text-[var(--text-muted)] mb-1">Vencimento</label>
                <input
                  id="pos-fi-maturity"
                  type="date"
                  value={fixedIncomeMaturity}
                  onChange={(e) => setFixedIncomeMaturity(e.target.value)}
                  className={fieldClass}
                />
              </div>
            </div>
            <p className="text-[10px] text-[var(--text-muted)]">
              Sem cotação de mercado — o valor investido é o próprio saldo, sempre a R$ 1,00 por unidade.
              Taxa e vencimento aparecem junto ao nome do título.
            </p>
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
              {kind === "market" ? "Corretora" : "Instituição"}
            </label>
            <input
              id="position-broker"
              type="text"
              value={broker}
              onChange={(e) => setBroker(e.target.value)}
              className={fieldClass}
              placeholder={kind === "market" ? "Ex: NuInvest" : "Ex: Banco X"}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
