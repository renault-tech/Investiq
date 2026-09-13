# Finanças — patch

Aplicar em 3 componentes; hooks/queries de todos ficam como estão. `bare` já existe em
`BudgetsSection` — usar `bare` (sem chrome próprio) quando embrulhado num container com o
gradiente do design, senão a borda dupla.

## 1. `SummaryCards.tsx` → cartão "Gasto no mês" (o design junta os 4 KPIs num card só, com
barra de progresso do orçamento total; o real são 4 cards separados). Trocar o card grid por:

```tsx
<div className="border border-[var(--border)] rounded-[var(--radius-card)] p-5 animate-rise-up" style={{ background: "linear-gradient(180deg,var(--t4),var(--t1))" }}>
  <p className="text-[11.5px] text-[var(--text-secondary)]">Gasto no mês</p>
  <div className="flex items-baseline gap-2.5 mt-2 flex-wrap">
    <span className="font-mono font-medium text-[clamp(24px,2.7vw,33px)] tracking-[-.035em] text-[var(--text-primary)] whitespace-nowrap">
      {cards[1].value /* Despesas · mês */}
    </span>
    <span className="text-[11.5px] text-[var(--text-secondary)]">de {mask(formatBRLExact(totalBudget))}</span>
  </div>
  <div className="h-[9px] rounded-full overflow-hidden mt-4" style={{ background: "var(--border)" }}>
    <div className="h-full" style={{ width: `${Math.min(100, budgetPct)}%`, background: "linear-gradient(90deg,var(--accent),var(--accent-2))" }} />
  </div>
  <div className="flex justify-between text-[10.5px] text-[var(--text-secondary)] mt-2">
    <span>{Math.round(budgetPct)}% usado</span>
    {projectedPct !== null && <span style={{ color: projectedPct > 100 ? "var(--warning)" : "var(--text-secondary)" }}>projeção {Math.round(projectedPct)}%</span>}
  </div>
  <div className="flex gap-3.5 flex-wrap mt-4 pt-3.5 border-t border-[var(--border)]">
    <div className="flex-1 min-w-[96px]"><div className="text-[10.5px] text-[var(--text-secondary)]">Entrou</div><div className="font-mono text-base mt-0.5" style={{ color: "var(--accent)" }}>{cards[0].value}</div></div>
    <div className="flex-1 min-w-[96px]"><div className="text-[10.5px] text-[var(--text-secondary)]">Sobrou</div><div className="font-mono text-base mt-0.5 text-[var(--text-primary)]">{cards[2].value}</div></div>
  </div>
</div>
```

`totalBudget` = soma de `budgets.map(b => Number(b.amount))` (hook `useBudgets` já usado em
`BudgetsSection`); `budgetPct` = `(despesas / totalBudget) * 100`; `projectedPct` = extrapolar
pelo dia do mês (`despesas / (dia atual / dias no mês) / totalBudget * 100`) — mesma conta que
`ForecastSection.tsx` já faz em outro contexto, reaproveitar se exposta, senão calcular inline.
As "Taxa de poupança" (`cards[3]`) e "Por dia" do design saem daqui — mover pro card de baixo
ou manter como card `SummaryCards` avulso menor; não é obrigatório encaixar tudo no card único.

## 2. `BudgetsSection.tsx` → "Orçamento por categoria" já é isto; só restilizar o container e
a cor da barra (hoje classes `bg-[var(--danger)]`/`bg-[var(--warning)]`/`bg-[var(--accent)]`
fixas por limiar — o design usa uma cor por categoria, não por status). Trocar `barColor`:

```tsx
// era: retorna bg-[var(--danger)] etc. por limiar de uso
// trocar por: usar budget.category_color sempre, e SÓ sinalizar estouro com
// uma faixa hachurada adicional (como o design faz na barra de gasto total).
```

E no `<li>`, trocar `className={... barColor(...)}` por `style={{ background: budget.category_color ?? "var(--accent)" }}` — mesma barra, cor por categoria em vez de por status (o status "estourou" já aparece no texto `formatBRLExact(spent)/formatBRLExact(amount)` em vermelho quando `pct_used > 1`, não precisa duplicar na cor da barra).

## 3. Novo: "Onde o dinheiro foi" (donut + lista) — o real tem `CategoryBars` (barras), não
donut. Não substituir `CategoryBars` (ele já é usado em mais de uma tela) — adicionar um
componente novo `CategoryDonut.tsx` só para este card da Visão Geral/Finanças:

```tsx
// apps/web/src/components/finances/CategoryDonut.tsx
"use client";
import type { CategorySummary } from "@/lib/finance-api";
import { formatBRLCompact } from "@/components/charts/chartTheme";
import { CATEGORICAL } from "@/components/charts/chartTheme";

export function CategoryDonut({ byCategory, totalLabel }: { byCategory: CategorySummary[]; totalLabel: string }) {
  const top = byCategory.slice(0, 6);
  let acc = 0;
  const stops = top.map((c, i) => {
    const pct = Number(c.pct) * 100;
    const from = acc; acc += pct;
    return `${c.category_color ?? CATEGORICAL[i % CATEGORICAL.length]} ${from}% ${acc}%`;
  }).join(", ");
  return (
    <div className="flex items-center gap-4">
      <div className="relative flex-shrink-0" style={{ width: 92, height: 92, borderRadius: "50%", background: `conic-gradient(${stops}, var(--border) ${acc}% 100%)` }}>
        <div className="absolute inset-[13px] rounded-full flex items-center justify-center" style={{ background: "var(--background)" }}>
          <div className="text-center">
            <div className="font-mono text-[13px] text-[var(--text-primary)]">{totalLabel}</div>
            <div className="text-[9px] text-[var(--text-muted)]">GASTO</div>
          </div>
        </div>
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        {top.map((c, i) => (
          <div key={c.category_id ?? c.category_name} className="flex items-center gap-2 text-[11.5px]">
            <span className="w-[7px] h-[7px] rounded-[2px] flex-shrink-0" style={{ background: c.category_color ?? CATEGORICAL[i % CATEGORICAL.length] }} />
            <span className="flex-1 min-w-0 truncate text-[var(--text-secondary)]">{c.category_name}</span>
            <span className="font-mono text-[11px] text-[var(--text-muted)]">{formatBRLCompact(Number(c.value))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

Mesma prop `byCategory` que `CategoryBars` já recebe (`useAnalytics`/`useFinanceSummary`) —
usar como alternativa visual lado a lado com `CategoryBars`, não em vez dela (`CategoryBars`
continua servindo Relatórios/Transações, que preferem lista longa a donut).
