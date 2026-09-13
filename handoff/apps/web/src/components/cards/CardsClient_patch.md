# Cartões — patch (aplicar em apps/web/src/components/cards/CardsClient.tsx)

Só apresentação; hooks/queries/mutations ficam como estão. Este patch assume que
`InvoiceAnalytics.tsx` e o módulo de analytics (rodada anterior) já foram aplicados.

## 1. Cartão visual — mesmo gradiente/chip do design, adicionar barra de limite

O real já tem `CARD_GRADIENTS` (4 cores) e mostra "Limite {valor}" só como texto — o design
mostra uma barra de progresso do limite usado. Trocar o bloco do cartão (dentro do `.map`
sobre `cards`) por:

```tsx
<div
  key={card.id}
  role="button" tabIndex={0}
  onClick={() => { setActiveCardId(card.id); setActiveInvoiceId(null); }}
  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { setActiveCardId(card.id); setActiveInvoiceId(null); } }}
  style={{ outline: card.id === selectedCardId ? "2px solid var(--accent)" : "none", outlineOffset: "2px" }}
  className="text-left w-[320px] rounded-[18px] p-5 flex flex-col gap-4 shadow-[var(--shadow)] transition-[outline] animate-rise-up cursor-pointer"
>
  <div
    className="rounded-[14px] p-4 relative overflow-hidden"
    style={{ background: CARD_GRADIENTS[i % CARD_GRADIENTS.length], minHeight: 100 }}
  >
    <div className="flex justify-between items-start">
      <span className="text-[13px] font-semibold text-[#F2F4F7]">{card.name}</span>
      <button onClick={(e) => { e.stopPropagation(); setEditingCard(card); }} aria-label={`Editar ${card.name}`} className="w-7 h-7 rounded-lg flex items-center justify-center text-[#F2F4F7] opacity-70 hover:opacity-100 hover:bg-white/10 transition-opacity">
        <Pencil size={13} />
      </button>
    </div>
    <div className="mt-4 font-mono text-[13px] tracking-[.06em] text-[rgba(255,255,255,.85)]">•••• •••• •••• {card.last4 ?? "----"}</div>
  </div>
  <div className="flex items-baseline justify-between gap-2.5">
    <div>
      <div className="text-[10.5px] text-[var(--text-muted)]">Fatura atual</div>
      <div className="font-mono text-[19px] font-medium mt-0.5 text-[var(--text-primary)]">
        {latestInvoiceOf(card)?.total_amount != null ? mask(formatBRLExact(Number(latestInvoiceOf(card)!.total_amount))) : "—"}
      </div>
    </div>
    <div className="text-right">
      <div className="text-[10.5px] text-[var(--text-muted)]">Vence</div>
      <div className="font-mono text-[13px] mt-0.5 text-[var(--text-primary)]">{card.due_day ? `dia ${card.due_day}` : "—"}</div>
    </div>
  </div>
  {card.credit_limit && (
    <>
      <div className="h-[5px] rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
        <div className="h-full rounded-full" style={{ width: `${limitPct(card)}%`, background: "var(--accent-2)" }} />
      </div>
      <div className="flex justify-between text-[10.5px] text-[var(--text-muted)]">
        <span>{limitPct(card)}% do limite</span>
        <span className="font-mono">limite {mask(formatBRLCompact(Number(card.credit_limit)))}</span>
      </div>
    </>
  )}
  <div className="flex gap-2">
    <button className="flex-1 text-center text-[11.5px] font-semibold rounded-[9px] py-2" style={{ color: "#04140E", background: "var(--accent)" }}>
      Pagar fatura
    </button>
    <button onClick={(e) => { e.stopPropagation(); setConfirmingCardDelete(true); }} className="text-center text-[11.5px] rounded-[9px] py-2 px-3" style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}>
      Detalhes
    </button>
  </div>
</div>
```

Helpers a adicionar (mesmo arquivo, fora do componente ou no topo do componente):

```tsx
function limitPct(card: CreditCard): number {
  // usa a última fatura carregada de todos os cartões (mesmo padrão de
  // `latestInvoices` já calculado no componente) — se ainda não houver
  // fatura pra este cartão, 0%.
  const inv = latestInvoiceOf(card);
  if (!card.credit_limit || !inv?.total_amount) return 0;
  return Math.min(100, Math.round((Number(inv.total_amount) / Number(card.credit_limit)) * 100));
}
```

(ajustar `latestInvoiceOf` para indexar no mesmo array `latestInvoices` que o componente já
constrói por `billCards`/`invoiceQueries` — reaproveitar, não duplicar a query.)

## 2. Zona de upload — 3 selos de confiança abaixo dos botões

`InvoiceUploadZone.tsx` já tem a copy certa (server-side, revisão humana). Adicionar a linha
de selos do design, dentro do estado "não enviando" (`!uploading`), depois do `<input type="file">`:

```tsx
<div className="w-full flex gap-4 flex-wrap justify-center pt-1">
  <span className="text-[10.5px] text-[var(--text-muted)] flex items-center gap-1.5">
    <span style={{ color: "var(--accent)" }}>●</span>IA revisada por você antes de confirmar
  </span>
  <span className="text-[10.5px] text-[var(--text-muted)] flex items-center gap-1.5">
    <span style={{ color: "var(--accent)" }}>●</span>Salvo na nuvem · histórico em qualquer lugar
  </span>
</div>
```

## 3. Nada mais muda

Grid de cartões, `InvoiceReviewTable`, `InvoiceAnalytics` (já aplicada) e lista de faturas já
herdam a paleta certa dos tokens globais (Etapa 1) — sem edição de JSX adicional ali.
