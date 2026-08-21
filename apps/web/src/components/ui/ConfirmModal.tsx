"use client";

import type { ReactNode } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";

interface ConfirmModalProps {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** false pra confirmações não-destrutivas — troca o botão de vermelho pro
   * accent do app. Todo caso hoje é destrutivo, mas não custa a opção. */
  danger?: boolean;
  isPending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** Substitui `window.confirm` — que quebra a identidade visual do app (é o
 * diálogo do navegador, não da InvestIQ), não formata o texto, e trava a
 * aba inteira em vez de só o fluxo atual. Mesmo par Cancelar/Confirmar de
 * sempre; ESC e clique fora fecham sem confirmar, como o Modal já garante. */
export function ConfirmModal({
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  danger = true,
  isPending = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      maxWidth="sm"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isPending}>
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            size="sm"
            onClick={onConfirm}
            loading={isPending}
            disabled={isPending}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-[var(--text-secondary)]">{message}</p>
    </Modal>
  );
}
