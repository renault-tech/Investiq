"use client";

import { useState } from "react";
import { CreditCard as CreditCardIcon, Pencil, Plus, Trash2, Upload } from "lucide-react";
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
import { CardInvoice, CreditCard } from "@/lib/cards-api";
import { formatBRL, formatBRLExact, formatBRLCompact } from "@/components/charts/chartTheme";
import { EmptyState } from "@/components/ui/EmptyState";
import { useMask } from "@/hooks/useMask";
import { CardModal } from "./CardModal";
import { InvoiceUploadZone } from "./InvoiceUploadZone";
import { InvoiceReviewTable } from "./InvoiceReviewTable";

const STATUS_LABEL: Record<CardInvoice["status"], { label: string; className: string }> = {
  processing: { label: "processando", className: "text-[var(--warning)]" },
  review: { label: "em revisão", className: "text-[var(--warning)]" },
  confirmed: { label: "confirmada ✓", className: "text-[var(--accent)]" },
  failed: { label: "falhou", className: "text-[var(--danger)]" },
};
// O backend guarda status como string livre (não um enum de banco), então um
// valor futuro ou legado que STATUS_LABEL não conheça não pode derrubar a
// tela inteira — só perde o rótulo bonito.
function statusInfo(status: CardInvoice["status"]) {
  return STATUS_LABEL[status] ?? { label: status, className: "text-[var(--text-muted)]" };
}

const CARD_GRADIENTS = [
  "linear-gradient(140deg,#14161C,#2B303B)",
  "linear-gradient(140deg,#0E6E53,#37D6A6)",
  "linear-gradient(140deg,#1D2A6E,#5A6BF0)",
  "linear-gradient(140deg,#6E1D3A,#D64C7C)",
];

function monthLabel(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  // "ago. de 2026" — a classe `capitalize` do CSS maiuscularia cada palavra
  // ("Ago. De 2026"); em português só a inicial deveria virar maiúscula.
  const label = d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}
function monthShort(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return d.toLocaleDateString("pt-BR", { month: "short" });
}

export function CardsClient() {
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null);
  const [showCardModal, setShowCardModal] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const mask = useMask();

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
  const billBars = invoices.slice().sort((a, b) => a.reference_month.localeCompare(b.reference_month)).slice(-8);
  const billMax = Math.max(1, ...billBars.map((b) => Number(b.total_amount ?? 0)));
  const topItems = (invoiceDetail?.items ?? [])
    .slice()
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .slice(0, 5);

  return (
    <div className="p-[26px_30px_60px] flex flex-col gap-[18px]">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Cartões</h2>
        <button
          onClick={() => setShowCardModal(true)}
          className="flex items-center gap-1.5 px-3.5 h-[34px] text-[12.5px] font-medium rounded-[11px]"
          style={{ background: "var(--accent)", color: "#04120D" }}
        >
          <Plus size={15} /> Novo cartão
        </button>
      </div>

      {/* Lista de cartões */}
      {cardsLoading ? (
        <div className="h-[196px] rounded-[22px] bg-[var(--surface-2)] animate-pulse" />
      ) : cards.length === 0 ? (
        <EmptyState icon={CreditCardIcon} title="Nenhum cartão cadastrado." description="Cadastre um cartão para importar faturas com IA." />
      ) : (
        <div className="flex flex-wrap gap-[18px]">
          {cards.filter((c) => c.is_active).map((card, i) => (
            <div
              key={card.id}
              role="button"
              tabIndex={0}
              onClick={() => { setActiveCardId(card.id); setActiveInvoiceId(null); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") { setActiveCardId(card.id); setActiveInvoiceId(null); }
              }}
              style={{
                background: CARD_GRADIENTS[i % CARD_GRADIENTS.length],
                outline: card.id === selectedCardId ? "2px solid var(--accent)" : "none",
                outlineOffset: "2px",
              }}
              className="text-left w-[320px] h-[196px] rounded-[22px] p-[22px] flex flex-col justify-between shadow-[var(--shadow)] transition-[outline] animate-rise-up cursor-pointer"
            >
              <div className="flex justify-between items-start">
                <span className="text-[13px] font-semibold text-[#F2F4F7]">{card.name}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingCard(card); }}
                    aria-label={`Editar ${card.name}`}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-[#F2F4F7] opacity-70 hover:opacity-100 hover:bg-white/10 transition-opacity"
                  >
                    <Pencil size={13} />
                  </button>
                  <div className="w-[34px] h-[24px] rounded-[6px]" style={{ background: "linear-gradient(135deg,#D7C089,#9E874A)" }} />
                </div>
              </div>
              <div>
                <div className="text-base tracking-[.14em] tabular-nums text-[#F2F4F7]">•••• •••• •••• {card.last4 ?? "----"}</div>
                <div className="flex justify-between mt-3 text-[11.5px] text-[#F2F4F7] opacity-70">
                  <span>{card.credit_limit ? mask(`Limite ${formatBRL(Number(card.credit_limit))}`) : (card.brand ?? "")}</span>
                  <span>{card.due_day ? `vence dia ${card.due_day}` : ""}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedCard && (
        <>
          <div className="responsive-grid-12 grid gap-[18px]" style={{ gridTemplateColumns: "repeat(12,1fr)" }}>
            <section className="col-span-7 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card)] p-6 shadow-[var(--shadow)] animate-rise-up">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-[var(--text-primary)]">Evolução da fatura</div>
                <div className="text-[11.5px] text-[var(--text-secondary)]">{selectedCard.name}</div>
              </div>
              {billBars.length === 0 ? (
                <EmptyState icon={Upload} title="Sem faturas ainda" description="Envie um PDF ou CSV abaixo." />
              ) : (
                <div className="flex items-end gap-3.5 h-[170px] mt-5.5">
                  {billBars.map((b, i) => (
                    <div key={b.id} className="flex-1 flex flex-col items-center gap-2">
                      <div className="w-full h-[140px] flex items-end">
                        <div
                          className="w-full rounded-t-[8px] rounded-b-[4px] animate-grow-y"
                          style={{
                            height: `${(Number(b.total_amount ?? 0) / billMax) * 100}%`,
                            background: i === billBars.length - 1 ? "var(--accent)" : "var(--surface-3)",
                          }}
                        />
                      </div>
                      <span className="text-[11px] text-[var(--text-muted)]">{monthShort(b.reference_month)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="col-span-5 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card)] p-6 shadow-[var(--shadow)] animate-rise-up" style={{ animationDelay: ".08s" }}>
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3.5">Maiores gastos do ciclo</div>
              {topItems.length === 0 ? (
                <p className="text-[12.5px] text-[var(--text-muted)]">Confirme uma fatura pra ver os maiores gastos aqui.</p>
              ) : (
                topItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 py-[11px] border-b border-[var(--border)]">
                    <div className="w-8 h-8 rounded-[11px] bg-[var(--surface-3)] flex items-center justify-center text-xs font-semibold text-[var(--text-secondary)]">
                      {item.description.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-medium truncate text-[var(--text-primary)]">{item.description}</div>
                      {item.installment_total && item.installment_total > 1 && (
                        <div className="text-[11px] text-[var(--text-muted)]">{item.installment_no}/{item.installment_total}</div>
                      )}
                    </div>
                    <b className="text-[13px] font-semibold tabular-nums text-[var(--text-primary)]">{mask(formatBRLCompact(Number(item.amount)))}</b>
                  </div>
                ))
              )}
            </section>
          </div>

          {/* Upload */}
          <InvoiceUploadZone
            onUpload={(file, referenceMonth) =>
              uploadMutation.mutate({ file, referenceMonth })
            }
            uploading={uploadMutation.isPending}
          />

          {/* Faturas */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-card-sm)] shadow-[var(--shadow)]">
            <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
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
                      className="w-full flex items-center gap-3 px-5 py-3 text-sm transition-colors hover:bg-[var(--surface-2)]"
                      style={{ background: invoice.id === activeInvoiceId ? "var(--surface-2)" : "transparent" }}
                    >
                      <span className="text-[var(--text-primary)] font-medium">
                        {monthLabel(invoice.reference_month)}
                      </span>
                      <span className={`text-xs ${statusInfo(invoice.status).className}`}>
                        {statusInfo(invoice.status).label}
                      </span>
                      {invoice.error_message && (
                        <span className="text-xs text-[var(--text-muted)] truncate">{invoice.error_message}</span>
                      )}
                      <span className="ml-auto tabular-nums text-[var(--text-secondary)]">
                        {invoice.total_amount != null ? mask(formatBRLExact(Number(invoice.total_amount))) : "—"}
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
      {editingCard && <CardModal card={editingCard} onClose={() => setEditingCard(null)} />}
    </div>
  );
}
