# Relatórios / Configurações / Ajuda — patches (visual only)

Estas 3 telas são as mais simples: pouco cálculo, o real já cobre os dados. Patch é só de
apresentação — grid de cards com o gradiente `linear-gradient(180deg,var(--t4),var(--t1))` e
radius/spacing do design em vez do card plano atual.

## Relatórios (`ReportsClient.tsx`)

Grid de 4 cards (Resumo mensal, Extrato consolidado, Rentabilidade vs benchmarks, Relatório
fiscal anual) — o real já gera PDF/CSV via `ExportReportModal.tsx`/`reports/*`. Trocar o
container de cada opção de exportação por:

```tsx
<div className="rounded-[18px] p-5 flex flex-col gap-3" style={{ border: "1px solid var(--border)", background: "linear-gradient(180deg,var(--t4),var(--t1))" }}>
  <div className="w-9 h-9 rounded-[11px] flex items-center justify-center flex-shrink-0" style={{ background: report.bg, color: report.fg }}>
    <report.Icon size={16} />
  </div>
  <div>
    <div className="text-[13.5px] font-semibold text-[var(--text-primary)]">{report.title}</div>
    <div className="text-[11.5px] text-[var(--text-secondary)] mt-1 leading-[1.5]">{report.description}</div>
  </div>
  <button onClick={report.onGenerate} className="mt-auto self-start text-[11.5px] font-semibold rounded-[9px] px-3 py-1.5" style={{ color: "#04140E", background: "var(--accent)" }}>
    {report.cta}
  </button>
</div>
```

Trocar os ícones emoji do mock (📊, 🧾) por lucide (`FileText`, `Download`, `BarChart2`,
`Landmark`) — mesma regra de ícone das outras telas.

## Configurações (`SettingsClient.tsx`)

Sem mudança estrutural — já é formulário (chave de IA, preferências, sessões). Só aplicar:
inputs com `border: 1px solid var(--border)`, `background: var(--surface-2)` (tokens novos já
cobrem isso automaticamente se o componente usa `var(--surface-2)`/`var(--border)` como já
faz); toggles de segurança (`SessionsSection.tsx`) como pill on/off do design:

```tsx
<div onClick={toggle} style={{ width: 32, height: 18, borderRadius: 10, padding: 2, cursor: "pointer", background: on ? "var(--accent)" : "var(--border)" }}>
  <div style={{ width: 14, height: 14, borderRadius: "50%", background: on ? "#04140E" : "var(--text-muted)", transform: `translateX(${on ? 14 : 0}px)`, transition: "transform .16s ease" }} />
</div>
```

## Ajuda (`HelpClient.tsx`)

Categorias como chips com contagem (o real provavelmente já lista tópicos por categoria) —
aplicar:

```tsx
<div className="rounded-[14px] p-4 flex items-center gap-3 cursor-pointer" style={{ border: "1px solid var(--border)", background: "linear-gradient(180deg,var(--t4),var(--t1))" }}>
  <div className="w-9 h-9 rounded-[11px] flex items-center justify-center flex-shrink-0" style={{ background: cat.bg, color: cat.fg }}>
    <cat.Icon size={16} />
  </div>
  <div className="flex-1 min-w-0">
    <div className="text-[12.5px] font-medium text-[var(--text-primary)]">{cat.title}</div>
    <div className="text-[10.5px] text-[var(--text-muted)]">{cat.count} artigos</div>
  </div>
</div>
```

Trocar emoji (📊🧾💳🔐) por lucide (`LineChart`, `Receipt`, `CreditCard`, `ShieldCheck`).

## Nada disto tem lógica nova — puro CSS/JSX em componentes já funcionais.
