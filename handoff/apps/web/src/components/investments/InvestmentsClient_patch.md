# Investimentos — patch (aplicar em InvestmentsClient.tsx)

Componente real é grande (30KB: PortfolioTabs, PositionsTable, BenchmarkChart, RebalanceTag,
AuditPanel, IncomeTab) — não reescrever o arquivo inteiro. Este patch cobre só o bloco
superior (hero + alocação + insights), que é onde o design difere mais visualmente. O resto
(tabela de posições, abas, auditoria) já herda os tokens da Etapa 1 sem editar JSX.

## 1. Hero "Investido" — mesmo gráfico SVG de Overview, + "vs CDI"

Reaproveitar o helper `buildAreaPath` do patch de Overview (mover para um arquivo compartilhado
tipo `lib/svg-path.ts` — **o repo já tem esse arquivo**, `apps/web/src/lib/svg-path.ts`; conferir
se já expõe algo equivalente antes de duplicar). Estrutura do card:

```tsx
<div className="rounded-[var(--radius-card)] p-5 pt-5" style={{ border: "1px solid var(--border)", background: "linear-gradient(180deg,var(--t4),var(--t1))" }}>
  <div className="flex items-start justify-between gap-4 flex-wrap">
    <div className="flex-1 min-w-[220px]">
      <div className="text-[11.5px] text-[var(--text-secondary)]">Investido · {activePortfolio?.name ?? "Consolidado"}</div>
      <div className="font-mono font-medium text-[clamp(26px,3.1vw,37px)] tracking-[-.035em] mt-1.5 text-[var(--text-primary)]">
        {mask(formatBRLExact(Number(summary?.total_market_value_brl ?? 0)))}
      </div>
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1" style={{ background: "var(--glow)", border: "1px solid color-mix(in srgb,var(--accent) 20%,transparent)" }}>
          <span style={{ color: "var(--accent)" }}>▲</span>
          <span className="font-mono text-[12.5px] font-medium" style={{ color: "var(--accent)" }}>
            {formatPercent(Number(summary?.total_pnl_percent ?? 0), 1, { signed: true })}
          </span>
        </div>
      </div>
    </div>
    <div className="text-right">
      <div className="text-[10.5px] text-[var(--text-secondary)] tracking-[.1em] uppercase">Vs CDI</div>
      <div className="font-mono text-[22px] font-medium mt-1" style={{ color: "var(--accent)" }}>
        {vsCdiLabel /* ver abaixo */}
      </div>
      <div className="text-[10.5px] text-[var(--text-secondary)] mt-0.5">12 meses</div>
    </div>
  </div>
  <div className="mt-4" style={{ height: 128 }}>
    {/* mesmo SVG do patch de Overview, alimentado por performance (getPortfolioPerformance) */}
  </div>
</div>
```

`vsCdiLabel`: já existe o dado — `getPortfolioBenchmark(id, "1y")` retorna `BenchmarkPoint[]`
com `portfolio_pct` e `cdi_pct` por data; pegar o último ponto e calcular
`portfolio_pct - cdi_pct` (excesso em p.p.), ou `(portfolio_pct / cdi_pct) * 100` se preferir
"% do CDI" como o texto do design ("169% do CDI"). Usar o hook que a tela já tem para o
gráfico de benchmark (`usePortfolioBenchmark.ts`) — não criar query nova.

## 2. Alocação por classe — conic-gradient (mesma receita do patch de Finanças/`CategoryDonut`)

Dado real: `summary.allocation_by_type` (`AllocationSlice[]`, já tem `asset_type`+`weight`).
Reaproveitar o mesmo componente `CategoryDonut` do patch de Finanças, generalizado (ele já
recebe `color`/`label`/`value` genéricos — só trocar `CategorySummary` por um tipo mais largo,
ou duplicar como `AllocationDonut.tsx`). **O repo já tem `AllocationDonut.tsx`** — abrir esse
arquivo primeiro; se ele já faz isto (nome sugere que sim), só restilizar as cores pro
`CATEGORICAL`/tokens novos, não recriar.

## 3. Ações inteligentes → ligar ao real `rebalance_suggestions`

O design mostra um card de "insights" com texto pronto; o real já calcula
`PortfolioSummaryResponse.rebalance_suggestions: list[dict]` por posição. Substituir o mock por:

```tsx
{summary?.rebalance_suggestions?.slice(0, 4).map((s, i) => (
  <div key={i} className="rounded-xl p-2.5" style={{ border: "1px solid var(--border)", background: "var(--surface-2)" }}>
    <div className="flex items-center gap-1.5">
      <span className="w-[5px] h-[5px] rounded-full flex-shrink-0" style={{ background: "var(--accent-2)" }} />
      <span className="text-[9.5px] tracking-[.1em] uppercase font-semibold" style={{ color: "var(--accent-2)" }}>Rebalanceamento</span>
    </div>
    <div className="text-[12px] text-[var(--text-secondary)] leading-[1.45] mt-1.5">
      {/* formatar s (ticker, ação, delta) — checar o shape exato de rebalance_suggestions em service.py antes de assumir campos */}
    </div>
  </div>
))}
```

Checar o formato exato de cada item de `rebalance_suggestions` em `portfolio/service.py`
antes de montar o texto (schema é `list[dict]` genérico, sem Pydantic tipado) — não inventar
campos.
