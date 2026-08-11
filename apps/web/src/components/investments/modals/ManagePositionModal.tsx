"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { formatBRLExact } from "@/components/charts/chartTheme";
import {
  usePositionTransactions,
  useUpdatePosition,
  useDeletePosition,
  useUpdateTransaction,
  useDeleteTransaction,
} from "@/hooks/usePositionActions";
import type { InvestmentTransaction } from "@/lib/portfolio-api";
import type { PositionSummary } from "@/lib/portfolio-api";

interface ManagePositionModalProps {
  portfolioId: string;
  position: PositionSummary;
  onClose: () => void;
}

const TX_TYPE_LABELS: Record<string, string> = {
  buy: "Compra",
  sell: "Venda",
  dividend: "Dividendo",
  split: "Desdobramento",
  bonus: "Bonificação",
};

const fieldClass =
  "w-full px-2.5 py-1.5 bg-[var(--background)] border border-[var(--border)] rounded-md text-[11px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]";

function TransactionRow({
  txn,
  onSave,
  onDelete,
  saving,
}: {
  txn: InvestmentTransaction;
  onSave: (input: { quantity: number; unit_price: number; fees: number; transaction_date: string }) => void;
  onDelete: () => void;
  saving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [quantity, setQuantity] = useState(String(txn.quantity));
  const [unitPrice, setUnitPrice] = useState(String(txn.unit_price));
  const [fees, setFees] = useState(String(txn.fees));
  const [date, setDate] = useState(txn.transaction_date.slice(0, 10));

  if (editing) {
    return (
      <div className="border border-[var(--border)] rounded-lg p-3 space-y-2 bg-[var(--surface-2)]">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor={`txn-qty-${txn.id}`} className="block text-[10px] text-[var(--text-muted)] mb-1">Quantidade</label>
            <input id={`txn-qty-${txn.id}`} type="number" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={fieldClass} />
          </div>
          <div>
            <label htmlFor={`txn-price-${txn.id}`} className="block text-[10px] text-[var(--text-muted)] mb-1">Preço unit.</label>
            <input id={`txn-price-${txn.id}`} type="number" step="any" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className={fieldClass} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor={`txn-fees-${txn.id}`} className="block text-[10px] text-[var(--text-muted)] mb-1">Taxas</label>
            <input id={`txn-fees-${txn.id}`} type="number" step="any" value={fees} onChange={(e) => setFees(e.target.value)} className={fieldClass} />
          </div>
          <div>
            <label htmlFor={`txn-date-${txn.id}`} className="block text-[10px] text-[var(--text-muted)] mb-1">Data</label>
            <input id={`txn-date-${txn.id}`} type="date" value={date} onChange={(e) => setDate(e.target.value)} className={fieldClass} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
            Cancelar
          </Button>
          <Button
            size="sm"
            loading={saving}
            disabled={!quantity || !unitPrice || Number(quantity) <= 0 || Number(unitPrice) <= 0}
            onClick={() => {
              onSave({
                quantity: parseFloat(quantity),
                unit_price: parseFloat(unitPrice),
                fees: parseFloat(fees) || 0,
                transaction_date: date,
              });
              setEditing(false);
            }}
          >
            Salvar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 py-2 border-b border-[var(--border)] last:border-0">
      <div className="min-w-0">
        <div className="text-[12px] text-[var(--text-primary)]">
          <span className="font-medium">{TX_TYPE_LABELS[txn.transaction_type] ?? txn.transaction_type}</span>{" "}
          <span className="text-[var(--text-secondary)]">
            {txn.quantity} × {formatBRLExact(txn.unit_price)}
          </span>
        </div>
        <div className="text-[10.5px] text-[var(--text-muted)]">
          {new Date(txn.transaction_date).toLocaleDateString("pt-BR")} · total {formatBRLExact(txn.total_amount)}
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => setEditing(true)}
          aria-label="Editar transação"
          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)]"
        >
          <Pencil size={13} />
        </button>
        <button
          onClick={onDelete}
          aria-label="Apagar transação"
          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--surface-2)]"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

export function ManagePositionModal({ portfolioId, position, onClose }: ManagePositionModalProps) {
  const { data: transactions = [], isLoading } = usePositionTransactions(position.position_id);
  const updatePosition = useUpdatePosition(portfolioId);
  const deletePosition = useDeletePosition(portfolioId);
  const updateTxn = useUpdateTransaction(portfolioId);
  const deleteTxn = useDeleteTransaction(portfolioId);

  const [broker, setBroker] = useState(position.broker ?? "");
  const [targetWeight, setTargetWeight] = useState(
    position.target_weight != null ? String(position.target_weight * 100) : ""
  );
  const [confirmDeletePosition, setConfirmDeletePosition] = useState(false);
  const [confirmDeleteTxn, setConfirmDeleteTxn] = useState<string | null>(null);

  const handleSaveDetails = () => {
    updatePosition.mutate({
      positionId: position.position_id,
      input: {
        broker: broker.trim() || null,
        target_weight: targetWeight.trim() ? Number(targetWeight) / 100 : null,
      },
    });
  };

  return (
    <Modal title={`Gerenciar ${position.ticker}`} onClose={onClose} maxWidth="lg">
      <div className="space-y-5">
        <section>
          <h3 className="text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-[.05em] mb-2">
            Detalhes do ativo
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="pos-broker" className="block text-[10px] text-[var(--text-muted)] mb-1">
                Corretora
              </label>
              <input
                id="pos-broker"
                value={broker}
                onChange={(e) => setBroker(e.target.value)}
                placeholder="Opcional"
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="pos-target" className="block text-[10px] text-[var(--text-muted)] mb-1">
                Peso alvo (%)
              </label>
              <input
                id="pos-target"
                type="number"
                min={0}
                max={100}
                step="any"
                value={targetWeight}
                onChange={(e) => setTargetWeight(e.target.value)}
                placeholder="Opcional"
                className={fieldClass}
              />
            </div>
          </div>
          <div className="flex justify-end mt-2">
            <Button size="sm" loading={updatePosition.isPending} onClick={handleSaveDetails}>
              Salvar detalhes
            </Button>
          </div>
        </section>

        <section>
          <h3 className="text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-[.05em] mb-2">
            Transações
          </h3>
          {isLoading ? (
            <div className="space-y-2">
              {[0, 1].map((i) => (
                <div key={i} className="h-10 bg-[var(--surface-2)] rounded-lg animate-pulse" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-[11.5px] text-[var(--text-muted)]">Nenhuma transação registrada ainda.</p>
          ) : (
            <div>
              {transactions.map((txn) =>
                confirmDeleteTxn === txn.id ? (
                  <div
                    key={txn.id}
                    className="flex items-center justify-between gap-2 py-2 border-b border-[var(--border)] last:border-0"
                  >
                    <span className="text-[11.5px] text-[var(--text-secondary)]">
                      Apagar esta transação? A posição será recalculada.
                    </span>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteTxn(null)}>
                        Cancelar
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        loading={deleteTxn.isPending}
                        onClick={() => {
                          deleteTxn.mutate(txn.id, { onSuccess: () => setConfirmDeleteTxn(null) });
                        }}
                      >
                        Apagar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <TransactionRow
                    key={txn.id}
                    txn={txn}
                    saving={updateTxn.isPending}
                    onSave={(input) => updateTxn.mutate({ transactionId: txn.id, input })}
                    onDelete={() => setConfirmDeleteTxn(txn.id)}
                  />
                )
              )}
            </div>
          )}
        </section>

        <section className="border-t border-[var(--border)] pt-4">
          {confirmDeletePosition ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11.5px] text-[var(--text-secondary)]">
                Remover {position.ticker} da carteira? Todo o histórico de transações dele some junto.
              </span>
              <div className="flex gap-1.5 flex-shrink-0">
                <Button variant="ghost" size="sm" onClick={() => setConfirmDeletePosition(false)}>
                  Cancelar
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  loading={deletePosition.isPending}
                  onClick={() => deletePosition.mutate(position.position_id, { onSuccess: onClose })}
                >
                  Remover ativo
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDeletePosition(true)}
              className="flex items-center gap-1.5 text-[11.5px] text-[var(--danger)] hover:underline"
            >
              <Trash2 size={13} /> Remover {position.ticker} da carteira
            </button>
          )}
        </section>
      </div>
    </Modal>
  );
}
