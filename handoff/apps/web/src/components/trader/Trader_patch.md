# Trader — patch (aplicar em TraderClient.tsx / WatchlistTable.tsx)

**Não portar o gráfico do mock.** O design usa uma linha SVG simples; o real usa
`CandlestickChart.tsx` (lightweight-charts, candles + indicadores técnicos reais:
RSI/MACD/Bollinger/SMA/EMA). O real é estritamente superior aqui — candle é o padrão do
mercado, o mock simplificou só porque HTML solto não carrega a lib. Manter o candlestick
real; só restilizar o que envolve.

## 1. Watchlist — cartão com o mesmo chrome dos demais (gradiente + radius do design)

Em `WatchlistTable.tsx`, trocar o container externo (hoje provavelmente `bg-[var(--surface)]
border rounded-xl`) por:

```tsx
<div className="rounded-[16px] overflow-hidden" style={{ border: "1px solid var(--border)", background: "linear-gradient(180deg,var(--t4),var(--t1))" }}>
  <div className="flex items-center justify-between px-3.5 py-3">
    <span className="text-[12px] font-semibold text-[var(--text-primary)]">Watchlist</span>
    {/* botão + já existe, manter */}
  </div>
  {/* linhas do watchlist: manter dados/handlers, trocar padding pra 10px 14px e
      border-top 1px solid var(--border) entre linhas, igual ao resto do produto */}
</div>
```

## 2. Tiles de indicador (RSI/MACD/etc.) — grid + card igual ao design

Onde a tela já lista os indicadores calculados (RSI, MACD, etc. — provavelmente em
`AssetIndicators`/`IndicatorToggle.tsx` ou dentro do próprio `TraderClient`), aplicar:

```tsx
<div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))" }}>
  {indicators.map((ind) => (
    <div key={ind.label} className="rounded-[14px] p-3.5" style={{ border: "1px solid var(--border)", background: "linear-gradient(180deg,var(--t4),var(--t1))" }}>
      <div className="text-[10.5px] text-[var(--text-muted)]">{ind.label}</div>
      <div className="font-mono text-[17px] font-medium mt-1.5" style={{ color: ind.color }}>{ind.value}</div>
      <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{ind.read}</div>
    </div>
  ))}
</div>
```

Dado real: os valores de RSI/MACD/Bollinger já vêm de `getAssetIndicators` (`market-api.ts`);
`ind.color`/`ind.read` (leitura tipo "sobrecomprado"/"neutro") é lógica de apresentação que já
deve existir em algum lugar da tela (checar antes de duplicar limiares de RSI/MACD).

## 3. Faixa de mercado (topo) — já existe como `MarketOverviewStrip.tsx`

Não recriar; só confirmar que usa os tokens novos (`var(--accent)`/`var(--danger)` em vez de
hex fixo) — mesma checagem de "sem hex literal" das outras telas.
