"use client";

import { Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import type { FinanceTransaction } from "@/lib/finance-api";

export type DeleteScope = "one" | "future" | "all";

interface DeleteTransactionModalProps {
  txn: FinanceTransaction;
  isPending: boolean;
  onConfirm: (scope: DeleteScope) => void;
  onClose: () => void;
}

/** Confirmação de exclusão — nomeia cada desfecho no próprio botão em vez de
 * encadear `window.confirm`s.
 *
 * Apagar uma parcela tinha dois `confirm()` em sequência: "OK apaga a série
 * inteira. Cancelar deixa você escolher apagar só esta parcela." Quem queria
 * desistir precisava cancelar duas vezes — "Cancelar" virou "próxima
 * pergunta", o oposto do que a palavra significa em todo o resto do sistema
 * operacional. E quem lia rápido e clicava OK achando "sim, apagar esta"
 * destruía a série inteira: a ação mais perigosa da tela ficava atrás do
 * botão de aparência mais inofensiva.
 *
 * Aqui cada desfecho é um botão com seu próprio rótulo, lado a lado — inclui
 * "esta e as futuras" (scope=future), que o back-end já suportava mas o
 * fluxo de confirm() nunca expunha por só ter dois botões disponíveis. */
export function DeleteTransactionModal({ txn, isPending, onConfirm, onClose }: DeleteTransactionModalProps) {
  const isInstallment = (txn.installment_total ?? 0) > 1;
  const label = txn.description || (txn.transaction_type === "income" ? "Receita" : "Despesa");

  if (isInstallment) {
    const remaining = txn.installment_total! - txn.installment_no! + 1;
    // "Esta e as futuras" só é uma opção própria quando existe parcela
    // anterior (senão é idêntica a "toda a série") e parcela seguinte (senão
    // é idêntica a "só esta"). Na parcela 1, mostrá-la de qualquer jeito
    // duplicava "toda a série" e o texto virava "As 0 já registradas antes
    // continuam." — uma frase sobre parcelas que não existem.
    const hasPast = txn.installment_no! > 1;
    const showFutureOption = hasPast && remaining > 1;
    return (
      <Modal title="Excluir parcela" onClose={onClose} maxWidth="md">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[var(--text-secondary)]">
            <span className="font-medium text-[var(--text-primary)]">&ldquo;{label}&rdquo;</span> é a parcela{" "}
            {txn.installment_no}/{txn.installment_total}. O que você quer excluir?
          </p>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => onConfirm("one")}
              disabled={isPending}
              className="text-left px-3.5 py-2.5 rounded-[11px] border border-[var(--border)] hover:border-[var(--danger)] hover:bg-[var(--surface-2)] transition-colors disabled:opacity-50"
            >
              <span className="block text-sm font-medium text-[var(--text-primary)]">Só esta parcela</span>
              <span className="block text-xs text-[var(--text-muted)]">
                As outras {txn.installment_total! - 1} continuam como estão.
              </span>
            </button>

            {showFutureOption && (
              <button
                onClick={() => onConfirm("future")}
                disabled={isPending}
                className="text-left px-3.5 py-2.5 rounded-[11px] border border-[var(--border)] hover:border-[var(--danger)] hover:bg-[var(--surface-2)] transition-colors disabled:opacity-50"
              >
                <span className="block text-sm font-medium text-[var(--text-primary)]">
                  Esta e as futuras ({remaining} parcelas)
                </span>
                <span className="block text-xs text-[var(--text-muted)]">
                  As {txn.installment_no! - 1} já registradas antes continuam.
                </span>
              </button>
            )}

            <button
              onClick={() => onConfirm("all")}
              disabled={isPending}
              className="text-left px-3.5 py-2.5 rounded-[11px] border border-[var(--border)] hover:border-[var(--danger)] hover:bg-[var(--surface-2)] transition-colors disabled:opacity-50"
            >
              <span className="block text-sm font-medium text-[var(--danger)]">
                Toda a série ({txn.installment_total} parcelas)
              </span>
              <span className="block text-xs text-[var(--text-muted)]">Inclui as já pagas.</span>
            </button>
          </div>

          <div className="flex justify-end pt-1">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={isPending}>
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title="Excluir transação"
      onClose={onClose}
      maxWidth="sm"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => onConfirm("one")}
            loading={isPending}
            disabled={isPending}
          >
            <Trash2 size={14} /> Excluir
          </Button>
        </>
      }
    >
      <p className="text-sm text-[var(--text-secondary)]">
        Excluir <span className="font-medium text-[var(--text-primary)]">&ldquo;{label}&rdquo;</span>?
        {txn.is_recurring && " A série recorrente inteira será encerrada — nenhuma ocorrência futura será criada."}
      </p>
    </Modal>
  );
}
