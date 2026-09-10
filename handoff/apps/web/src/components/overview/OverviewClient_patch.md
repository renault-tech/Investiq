# Overview — patch (aplicar em apps/web/src/components/overview/OverviewClient.tsx)

Só a apresentação de 2 blocos muda; TODA a lógica (hooks, queries, cálculo de netWorth,
perfValues, savingsFraction, flowSeries etc.) fica exatamente como está — nenhuma linha antes
do `return (` é tocada.

## 1. Gráfico de patrimônio — troca AreaLineChart por SVG do design (linha + área + traço de perdas)

Adicionar este helper perto do topo do arquivo (fora do componente, junto de `mergePerformanceSeries`):

```tsx
function buildAreaPath(values: number[]): { area: string; line: string } {
  if (values.length < 2) return { area: "", line: "" };
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * 1000;
    const y = 280 - ((v - min) / span) * 260; // margem de 20px em cima/baixo, viewBox 1000x300
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = pts.join(" ");
  const area = `0,300 ${line} 1000,300`;
  return { area, line };
}
```

Substituir o bloco (dentro do card "net"):

```tsx
{perfValues.length >= 2 ? (
  <>
    <AreaLineChart values={perfValues} className="mt-3.5" />
    <div className="flex justify-between px-0.5 pb-1 text-[11px] text-[var(--text-muted)]">
      {axisLabels.map((l, i) => <span key={i}>{l}</span>)}
    </div>
  </>
) : ( ... )}
```

por:

```tsx
{perfValues.length >= 2 ? (
  <>
    <div className="mt-3.5 relative" style={{ height: 126 }}>
      <svg viewBox="0 0 1000 300" preserveAspectRatio="none" style={{ width: "100%", height: "100%", overflow: "visible" }}>
        <defs>
          <linearGradient id="ovFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity=".32" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={buildAreaPath(perfValues).area} fill="url(#ovFill)" />
        <polyline
          points={buildAreaPath(perfValues).line}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2.4}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
      </svg>
    </div>
    <div className="flex justify-between px-0.5 pb-1 pt-2 text-[11px] text-[var(--text-muted)]">
      {axisLabels.map((l, i) => <span key={i}>{l}</span>)}
    </div>
  </>
) : ( /* ...mantém o bloco de "sem histórico" como está... */ )}
```

Nenhum dado novo — `perfValues` já é a série real (snapshots + reconstrução de transações);
só o desenho muda de `<AreaLineChart>` (componente de barra fina) pra linha+área com
gradiente, igual ao design.

## 2. Saúde financeira — anel conic-gradient no lugar de `<DonutRing>`

Substituir, dentro do card "health":

```tsx
<DonutRing size={96} strokeWidth={9} segments={[{ fraction: Math.max(0, Math.min(1, savingsFraction)), color: "var(--accent)" }]} />
```

por:

```tsx
<div
  className="relative flex-shrink-0"
  style={{
    width: 88, height: 88, borderRadius: "50%",
    background: `conic-gradient(var(--accent) 0% ${Math.max(0, Math.min(1, savingsFraction)) * 100}%, var(--border) ${Math.max(0, Math.min(1, savingsFraction)) * 100}% 100%)`,
  }}
>
  <div className="absolute inset-[11px] rounded-full flex items-center justify-center" style={{ background: "var(--background)" }}>
    <div className="text-center">
      <div className="font-mono text-[20px] font-medium text-[var(--text-primary)]">
        {lastSavings?.savings_rate != null ? Math.round(savingsFraction * 100) : "—"}
      </div>
      <div className="text-[9px] text-[var(--text-muted)]">% poupado</div>
    </div>
  </div>
</div>
```

Mesmo dado (`savingsFraction`, já calculado de `analytics.savings_series`); só a forma do anel
muda de SVG segmentado pra `conic-gradient` puro, igual ao design (que usa `78/100` — aqui
mantemos o dado real, taxa de poupança, em vez de inventar um "score" composto que o backend
não calcula).

## 3. Fluxo de caixa — barras com topo arredondado + gradiente (visual only)

Trocar o `background` sólido das duas barras dentro de `flowSeries.map(...)`:

```tsx
style={{ background: "var(--accent)", height: `${(m.income / flowMax) * 100}%` }}
...
style={{ background: "var(--surface-3)", height: `${(m.expense / flowMax) * 100}%`, animationDelay: ".1s" }}
```

por:

```tsx
style={{ background: "linear-gradient(180deg,var(--accent),color-mix(in srgb,var(--accent) 25%,transparent))", height: `${(m.income / flowMax) * 100}%` }}
...
style={{ background: "linear-gradient(180deg,var(--danger),color-mix(in srgb,var(--danger) 22%,transparent))", height: `${(m.expense / flowMax) * 100}%`, animationDelay: ".1s" }}
```

(o design usa saída em vermelho translúcido, não cinza — ajuste de cor, mesma lógica de dados).

Nada mais muda nesta tela — os cards de conta/carteira, metas, movimentações e fatura já usam
os tokens (`var(--surface)`, `var(--accent)`, `var(--danger)`...) que a Etapa 1
(`globals_tokens.css`) substitui globalmente, então já saem com a paleta certa sem qualquer
edição de JSX.
