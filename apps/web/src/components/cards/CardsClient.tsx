"use client";

import { useRef, useState } from "react";
import { CreditCard as CreditCardIcon, Pencil, Plus, Trash2, Upload } from "lucide-react";
import {
  useCards,
  useInvoices,
  useLatestInvoices,
  useInvoiceDetail,
  useDeleteCard,
  useUploadInvoice,
  useConfirmInvoice,
  useDeleteInvoice,
} from "@/hooks/useCards";
import { useCategories, useTransactions } from "@/hooks/useFinance";
import { CardInvoice, CreditCard } from "@/lib/cards-api";
import { formatBRL, formatBRLExact, formatBRLCompact } from "@/components/charts/chartTheme";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useMask } from "@/hooks/useMask";
import { CardModal } from "./CardModal";
import { InvoiceUploadZone } from "./InvoiceUploadZone";
import { InvoiceReviewTable } from "./InvoiceReviewTable";
import { InvoiceAnalytics } from "./InvoiceAnalytics";
import { SubscriptionsSection } from "@/components/finances/SubscriptionsSection";

function currentMonthBounds(): { from: string; to: string } {
  // ISO completo (com fuso), igual a Finanças: "2026-10-31" puro chegava ao
  // backend como meia-noite sem fuso — cortava o último dia inteiro e a
  // lista de assinaturas daqui divergia da de Finanças.
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
  return { from, to };
}

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

function limitPct(card: CreditCard, invoice: CardInvoice | undefined): number {
  if (!card.credit_limit || !invoice?.total_amount) return 0;
  return Math.min(100, Math.round((Number(invoice.total_amount) / Number(card.credit_limit)) * 100));
}

function CardsSummary({
  cards,
  latestInvoiceByCard,
}: {
  cards: CreditCard[];
  latestInvoiceByCard: Map<string, CardInvoice | undefined>;
}) {
  const mask = useMask();
  const invoices = cards.map((c) => latestInvoiceByCard.get(c.id)).filter((x): x is CardInvoice => !!x);
  const totalOpen = invoices.reduce((sum, inv) => sum + Number(inv.total_amount ?? 0), 0);
  const withLimit = cards.filter((c) => c.credit_limit != null);
  const totalLimit = withLimit.reduce((sum, c) => sum + Number(c.credit_limit), 0);
  const usedOnLimited = withLimit.reduce((sum, c) => sum + Number(latestInvoiceByCard.get(c.id)?.total_amount ?? 0), 0);
  const available = Math.max(0, totalLimit - usedOnLimited);
  const usedPct = totalLimit > 0 ? Math.min(100, (usedOnLimited / totalLimit) * 100) : null;

  const now = new Date();
  const today = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const nextDue = cards
    .filter((c) => c.due_day)
    .map((c) => {
      const due = c.due_day as number;
      return { card: c, inDays: due >= today ? due - today : daysInMonth - today + due };
    })
    .sort((a, b) => a.inDays - b.inDays)[0];
  const inReview = invoices.filter((inv) => inv.status === "review").length;

  const stat = (label: string, value: string, hint?: string, color?: string) => (
    <div className="min-w-0">
      <div className="text-[11px] text-[var(--text-secondary)]">{label}</div>
      <div className="font-mono text-[19px] font-medium mt-1 tabular-nums truncate" style={{ color: color ?? "var(--text-primary)" }}>{value}</div>
      {hint && <div className="text-[10.5px] text-[var(--text-muted)] mt-0.5">{hint}</div>}
    </div>
  );

  return (
    <section className="flex-1 min-w-[300px] border border-[var(--border)] bg-[var(--surface)] rounded-[22px] p-[22px] shadow-[var(--shadow)] animate-rise-up flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-[var(--text-primary)]">Resumo dos cartões</div>
        <span className="text-[11px] text-[var(--text-muted)]">{cards.length} ativo{cards.length === 1 ? "" : "s"}</span>
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {stat("Faturas atuais", mask(formatBRL(totalOpen)), `${invoices.length} de ${cards.length} com fatura`)}
        {stat("Limite total", totalLimit > 0 ? mask(formatBRL(totalLimit)) : "—", withLimit.length < cards.length ? "nem todo cartão tem limite" : undefined)}
        {stat("Limite disponível", totalLimit > 0 ? mask(formatBRL(available)) : "—", undefined, "var(--accent)")}
        {stat(
          "Próximo vencimento",
          nextDue ? `dia ${nextDue.card.due_day}` : "—",
          nextDue ? `${nextDue.card.name}${nextDue.inDays === 0 ? " · hoje" : ` · em ${nextDue.inDays} dia${nextDue.inDays === 1 ? "" : "s"}`}` : undefined
        )}
      </div>
      {usedPct != null && (
        <div className="mt-auto">
          <div className="h-[7px] rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
            <div className="h-full rounded-full" style={{ width: `${usedPct}%`, background: usedPct > 80 ? "var(--danger)" : "linear-gradient(90deg,var(--accent),var(--accent-2))" }} />
          </div>
          <div className="flex justify-between text-[10.5px] text-[var(--text-secondary)] mt-1.5">
            <span>{Math.round(usedPct)}% do limite somado em uso</span>
            {inReview > 0 && <span className="text-[var(--warning)]">{inReview} fatura{inReview > 1 ? "s" : ""} aguardando confirmação</span>}
          </div>
        </div>
      )}
    </section>
  );
}

export function CardsClient() {
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null);
  const [showCardModal, setShowCardModal] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [confirmingCardDelete, setConfirmingCardDelete] = useState(false);
  const [confirmingInvoiceDelete, setConfirmingInvoiceDelete] = useState(false);
  const mask = useMask();

  const { data: cards = [], isLoading: cardsLoading } = useCards();
  const selectedCardId = activeCardId ?? cards[0]?.id ?? null;
  const { data: invoices = [] } = useInvoices(selectedCardId);
  const { data: invoiceDetail } = useInvoiceDetail(activeInvoiceId);
  const { data: categories = [] } = useCategories();
  const { from: monthFrom, to: monthTo } = currentMonthBounds();
  const { data: monthTxns } = useTransactions({ date_from: monthFrom, date_to: monthTo, transaction_type: "expense", per_page: 200 });

  const activeCards = cards.filter((c) => c.is_active);
  const latestInvoiceByCard = useLatestInvoices(activeCards.map((c) => c.id));
  const invoicesSectionRef = useRef<HTMLDivElement>(null);

  const deleteCardMutation = useDeleteCard();
  const uploadMutation = useUploadInvoice(selectedCardId);
  const confirmMutation = useConfirmInvoice(selectedCardId);
  const deleteInvoiceMutation = useDeleteInvoice(selectedCardId);

  const selectedCard = cards.find((c) => c.id === selectedCardId);
  const billBars = invoices.slice().sort((a, b) => a.reference_month.localeCompare(b.reference_month)).slice(-8);
  const billMax = Math.max(1, ...billBars.map((b) => Number(b.total_amount ?? 0)));
  // "Maiores gastos" usa a fatura aberta, ou a mais recente do cartão quando
  // nenhuma está aberta — antes o card ficava vazio até alguém clicar numa.
  const latestBillId = billBars[billBars.length - 1]?.id ?? null;
  const { data: latestBillDetail } = useInvoiceDetail(activeInvoiceId ? null : latestBillId);
  const topItems = ((activeInvoiceId ? invoiceDetail : latestBillDetail)?.items ?? [])
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
          style={{ background: "var(--accent)", color: "var(--on-accent)" }}
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
        <div className="flex flex-wrap items-stretch gap-[18px]">
          {activeCards.map((card, i) => {
            const latestInvoice = latestInvoiceByCard.get(card.id);
            const pct = limitPct(card, latestInvoice);
            return (
              <div
                key={card.id}
                role="button"
                tabIndex={0}
                // Sem isto o nome acessível do card é a concatenação de todo
                // texto interno, incluindo o rótulo do botão "Editar"
                // aninhado — confuso em leitor de tela e ambíguo em teste.
                aria-label={`Cartão ${card.name}${card.id === selectedCardId ? ", selecionado" : ""}`}
                aria-pressed={card.id === selectedCardId}
                onClick={() => { setActiveCardId(card.id); setActiveInvoiceId(null); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") { setActiveCardId(card.id); setActiveInvoiceId(null); }
                }}
                style={{
                  background: CARD_GRADIENTS[i % CARD_GRADIENTS.length],
                  outline: card.id === selectedCardId ? "2px solid var(--accent)" : "none",
                  outlineOffset: "2px",
                }}
                className="text-left w-[320px] rounded-[22px] p-[22px] flex flex-col gap-3 shadow-[var(--shadow)] transition-[outline] animate-rise-up cursor-pointer"
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
                <div className="text-base tracking-[.14em] tabular-nums text-[#F2F4F7]">•••• •••• •••• {card.last4 ?? "----"}</div>
                <div className="flex justify-between items-baseline text-[11.5px] text-[#F2F4F7] opacity-80">
                  <span>
                    {latestInvoice?.total_amount != null
                      ? mask(`Fatura atual ${formatBRL(Number(latestInvoice.total_amount))}`)
                      : "sem fatura ainda"}
                  </span>
                  <span>{card.due_day ? `vence dia ${card.due_day}` : ""}</span>
                </div>
                {/* Barra de limite: só quando o cartão tem limite cadastrado
                    E já teve pelo menos uma fatura — sem isso, 0% seria
                    enganoso ("cheio de espaço" pra um cartão que ainda não
                    foi usado no app, quando na real é "não sei"). */}
                {card.credit_limit != null && latestInvoice && (
                  <div className="flex flex-col gap-1">
                    <div className="h-[5px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.18)" }}>
                      <div
                        className="h-full rounded-full transition-[width]"
                        style={{ width: `${pct}%`, background: "#F2F4F7" }}
                      />
                    </div>
                    <div className="flex justify-between text-[10.5px] text-[#F2F4F7] opacity-70">
                      <span>{pct}% do limite</span>
                      <span className="font-mono">{mask(formatBRLCompact(Number(card.credit_limit)))}</span>
                    </div>
                  </div>
                )}
                {/* CTA principal sempre visível, como no design — mas o rótulo
                    conta a verdade: "confirmar" é converter os itens da
                    fatura lida por IA em lançamentos reais, o que só faz
                    sentido enquanto ela está em revisão. Fora disso não há
                    "pagamento" nenhum a registrar aqui (o app não controla
                    se a fatura do banco foi paga), então o botão leva pros
                    detalhes em vez de fingir uma ação que erraria (409/422
                    no confirm de uma fatura já confirmada). */}
                <div className="flex items-center gap-2 mt-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveCardId(card.id);
                      setActiveInvoiceId(latestInvoice && latestInvoice.status === "review" ? latestInvoice.id : null);
                      setTimeout(() => invoicesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
                    }}
                    className="flex-1 h-[30px] rounded-[9px] text-[11.5px] font-semibold transition-opacity hover:opacity-90"
                    style={{ background: "#F2F4F7", color: "#14161C" }}
                  >
                    {latestInvoice && latestInvoice.status === "review" ? "Confirmar fatura" : "Ver fatura"}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveCardId(card.id);
                      setActiveInvoiceId(null);
                      setTimeout(() => invoicesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
                    }}
                    className="flex-1 h-[30px] rounded-[9px] text-[11.5px] font-medium text-[#F2F4F7] transition-colors hover:bg-white/10"
                    style={{ background: "rgba(255,255,255,.12)" }}
                  >
                    Detalhes
                  </button>
                </div>
              </div>
            );
          })}
          {/* Resumo ao lado dos cartões: ocupa a faixa que ficava vazia à
              direita de um ou dois cartões e responde de cara "quanto devo
              e quanto ainda tenho de limite". Só soma o que existe — cartão
              sem limite cadastrado ou sem fatura não entra na conta. */}
          <CardsSummary cards={activeCards} latestInvoiceByCard={latestInvoiceByCard} />
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
                // Largura máxima por barra: com 1 ou 2 faturas a barra
                // ocupava o card inteiro e virava um bloco verde sem leitura.
                <div className="flex items-end justify-center gap-3.5 h-[190px] mt-5.5">
                  {billBars.map((b, i) => (
                    <div key={b.id} className="flex-1 max-w-[76px] flex flex-col items-center gap-2">
                      <span className="text-[10.5px] tabular-nums text-[var(--text-secondary)] whitespace-nowrap">
                        {mask(formatBRLCompact(Number(b.total_amount ?? 0)))}
                      </span>
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
          <div ref={invoicesSectionRef} className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-card-sm)] shadow-[var(--shadow)] scroll-mt-6">
            <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Faturas — {selectedCard.name}
              </h3>
              <button
                onClick={() => setConfirmingCardDelete(true)}
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
            <>
              <InvoiceReviewTable
                invoice={invoiceDetail}
                categories={categories}
                onConfirm={() => confirmMutation.mutate(invoiceDetail.id)}
                onDelete={() => setConfirmingInvoiceDelete(true)}
                confirming={confirmMutation.isPending}
              />
              <InvoiceAnalytics invoiceId={invoiceDetail.id} />
            </>
          )}

          {/* Assinaturas e recorrentes — mesmo componente de Finanças,
              lançamentos do mês corrente (inclui os que vieram de fatura de
              cartão confirmada, já marcados como recorrentes lá). */}
          <div className="border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card)] p-6 shadow-[var(--shadow)] animate-rise-up">
            <SubscriptionsSection transactions={monthTxns?.items ?? []} />
          </div>
        </>
      )}

      {showCardModal && <CardModal onClose={() => setShowCardModal(false)} />}
      {editingCard && <CardModal card={editingCard} onClose={() => setEditingCard(null)} />}
      {confirmingCardDelete && selectedCard && (
        <ConfirmModal
          title="Remover cartão"
          message={
            <>
              Remover o cartão &ldquo;{selectedCard.name}&rdquo;? O histórico de faturas deste cartão é apagado — despesas
              já lançadas de faturas confirmadas continuam na sua lista de transações, só o histórico da fatura em si
              (itens extraídos, status) some.
            </>
          }
          confirmLabel="Remover"
          isPending={deleteCardMutation.isPending}
          onConfirm={() =>
            deleteCardMutation.mutate(selectedCard.id, {
              onSuccess: () => {
                setConfirmingCardDelete(false);
                setActiveCardId(null);
              },
            })
          }
          onClose={() => setConfirmingCardDelete(false)}
        />
      )}
      {confirmingInvoiceDelete && invoiceDetail && (
        <ConfirmModal
          title="Excluir fatura"
          message="Excluir esta fatura e todos os itens extraídos? Como ela ainda não foi confirmada, nenhuma despesa chegou a ser lançada — não há nada além da fatura em si pra recuperar depois."
          confirmLabel="Excluir"
          isPending={deleteInvoiceMutation.isPending}
          onConfirm={() =>
            deleteInvoiceMutation.mutate(invoiceDetail.id, {
              onSuccess: () => {
                setConfirmingInvoiceDelete(false);
                setActiveInvoiceId(null);
              },
            })
          }
          onClose={() => setConfirmingInvoiceDelete(false)}
        />
      )}
    </div>
  );
}
