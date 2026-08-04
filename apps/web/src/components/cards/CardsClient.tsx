"use client";

import { useState } from "react";
import { CreditCard as CreditCardIcon, Plus, Trash2, Upload } from "lucide-react";
import {
  useCards,
  useInvoices,
  useInvoiceDetail,
  useDeleteCard,
  useUploadInvoice,
  useConfirmInvoice,
  useDeleteInvoice,
} from "@/hooks/useCards";
import { useCategories } from "@/hooks/useFinance";
import { CardInvoice } from "@/lib/cards-api";
import { formatBRL } from "@/components/charts/chartTheme";
import { CardModal } from "./CardModal";
import { InvoiceUploadZone } from "./InvoiceUploadZone";
import { InvoiceReviewTable } from "./InvoiceReviewTable";

const STATUS_LABEL: Record<CardInvoice["status"], { label: string; className: string }> = {
  processing: { label: "processando", className: "text-[var(--warning)]" },
  review: { label: "em revisão", className: "text-[var(--warning)]" },
  confirmed: { label: "confirmada ✓", className: "text-[var(--accent)]" },
  failed: { label: "falhou", className: "text-[var(--danger)]" },
};

function monthLabel(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
}

export function CardsClient() {
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null);
  const [showCardModal, setShowCardModal] = useState(false);

  const { data: cards = [], isLoading: cardsLoading } = useCards();
  const selectedCardId = activeCardId ?? cards[0]?.id ?? null;
  const { data: invoices = [] } = useInvoices(selectedCardId);
  const { data: invoiceDetail } = useInvoiceDetail(activeInvoiceId);
  const { data: categories = [] } = useCategories();

  const deleteCardMutation = useDeleteCard();
  const uploadMutation = useUploadInvoice(selectedCardId);
  const confirmMutation = useConfirmInvoice(selectedCardId);
  const deleteInvoiceMutation = useDeleteInvoice(selectedCardId);

  const selectedCard = cards.find((c) => c.id === selectedCardId);

  return (
    <div className="p-6 max-w-6xl mx-auto w-full space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Cartões</h1>
        <button
          onClick={() => setShowCardModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[var(--navy)] text-white rounded-lg hover:opacity-90"
        >
          <Plus size={15} /> Novo cartão
        </button>
      </div>

      {/* Lista de cartões */}
      {cardsLoading ? (
        <div className="h-28 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
      ) : cards.length === 0 ? (
        <div className="py-16 text-center text-[var(--text-muted)] border border-dashed border-[var(--border)] rounded-lg">
          <CreditCardIcon className="mx-auto mb-2" size={28} />
          <p className="font-medium">Nenhum cartão cadastrado.</p>
          <p className="text-sm mt-1">Cadastre um cartão para importar faturas com IA.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {cards.filter((c) => c.is_active).map((card) => (
            <button
              key={card.id}
              onClick={() => { setActiveCardId(card.id); setActiveInvoiceId(null); }}
              className={`text-left rounded-lg border p-4 transition-colors ${
                card.id === selectedCardId
                  ? "border-[var(--navy)] bg-[var(--surface)] ring-1 ring-[var(--navy)]"
                  : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong,var(--border))]"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-[var(--text-primary)]">{card.name}</span>
                <span className="text-xs uppercase text-[var(--text-muted)]">{card.brand ?? ""}</span>
              </div>
              <p className="font-mono text-sm text-[var(--text-secondary)] mt-2">
                •••• {card.last4 ?? "????"}
              </p>
              <div className="flex justify-between mt-2 text-xs text-[var(--text-muted)]">
                <span>{card.credit_limit ? `Limite ${formatBRL(Number(card.credit_limit))}` : ""}</span>
                <span>
                  {card.closing_day ? `fecha dia ${card.closing_day}` : ""}
                  {card.due_day ? ` · vence dia ${card.due_day}` : ""}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedCard && (
        <>
          {/* Upload */}
          <InvoiceUploadZone
            onUpload={(file, referenceMonth) =>
              uploadMutation.mutate({ file, referenceMonth })
            }
            uploading={uploadMutation.isPending}
          />

          {/* Faturas */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Faturas — {selectedCard.name}
              </h3>
              <button
                onClick={() => {
                  if (window.confirm(`Remover o cartão ${selectedCard.name}? Faturas não confirmadas serão perdidas.`)) {
                    deleteCardMutation.mutate(selectedCard.id);
                    setActiveCardId(null);
                  }
                }}
                className="p-1.5 text-[var(--text-muted)] hover:text-[var(--danger)]"
                aria-label="Remover cartão"
              >
                <Trash2 size={15} />
              </button>
            </div>
            {invoices.length === 0 ? (
              <p className="p-6 text-sm text-[var(--text-muted)] text-center">
                <Upload size={16} className="inline mr-1" />
                Nenhuma fatura importada ainda — envie o PDF ou CSV acima.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {invoices.map((invoice) => (
                  <li key={invoice.id}>
                    <button
                      onClick={() => setActiveInvoiceId(invoice.id === activeInvoiceId ? null : invoice.id)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-900/50 ${
                        invoice.id === activeInvoiceId ? "bg-slate-50 dark:bg-slate-900/50" : ""
                      }`}
                    >
                      <span className="capitalize text-[var(--text-primary)] font-medium">
                        {monthLabel(invoice.reference_month)}
                      </span>
                      <span className={`text-xs ${STATUS_LABEL[invoice.status].className}`}>
                        {STATUS_LABEL[invoice.status].label}
                      </span>
                      {invoice.error_message && (
                        <span className="text-xs text-[var(--text-muted)] truncate">{invoice.error_message}</span>
                      )}
                      <span className="ml-auto font-mono text-[var(--text-secondary)]">
                        {invoice.total_amount != null ? formatBRL(Number(invoice.total_amount)) : "—"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Revisão da fatura selecionada */}
          {invoiceDetail && activeInvoiceId && (
            <InvoiceReviewTable
              invoice={invoiceDetail}
              categories={categories}
              onConfirm={() => confirmMutation.mutate(invoiceDetail.id)}
              onDelete={() => {
                if (window.confirm("Excluir esta fatura e todos os itens extraídos?")) {
                  deleteInvoiceMutation.mutate(invoiceDetail.id);
                  setActiveInvoiceId(null);
                }
              }}
              confirming={confirmMutation.isPending}
            />
          )}
        </>
      )}

      {showCardModal && <CardModal onClose={() => setShowCardModal(false)} />}
    </div>
  );
}
