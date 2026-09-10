## Diretiva desta rodada: layout daqui, base de lá

Instrução do usuário: aplicar exatamente o LAYOUT/visual deste projeto (`InvestIQ Wealth OS.dc.html`)
em cada tela, mesmo onde o componente real já é "mais maduro" — **manter os hooks/APIs/lógica
de negócio reais** (não recriar dados fake), só substituir a apresentação. Isto muda a
orientação anterior (que dizia "não tocar" em telas já maduras) — agora toda tela é candidata
a reestilização, sempre preservando o componente de dados por trás.

Ordem de aplicação recomendada (fundação primeiro, senão cada tela reestilizada depois briga
com os tokens antigos):
1. `handoff/apps/web/src/app/globals_tokens.css` → colar por cima do bloco `:root{}`/`.dark{}`
   de `apps/web/src/app/globals.css` (cores, radii, sombra exatos do design; manter
   keyframes/utilitários abaixo como estão).
2. Sidebar/TopBar (chrome) — próximo lote.
3. Chrome pronto nesta rodada — substituição direta, mesmos hooks/dados:
   - `handoff/apps/web/src/components/layout/Sidebar.tsx` (rail 246px, item ativo com dot
     quadrado, caixa "IQ Insight").
   - `handoff/apps/web/src/components/layout/TopBar.tsx` (breadcrumb fino + faixa de
     cotações ao vivo — usa `handoff/apps/web/src/hooks/useMarketTicker.ts`, que só embrulha
     `getMarketQuotes` já existente em `market-api.ts`; nenhuma API nova).
4. Cada tela de conteúdo (Overview, Finanças, Investimentos, Trader, Metas, Relatórios,
   Cartões, Transações, Ajuda, Configurações) — mesma receita: reestilizar o JSX por dentro,
   mantendo `useQuery`/hooks exatamente como estão; só a árvore de `className`/estilo muda.
   Não incluídas nesta rodada (escopo grande, uma por vez evita regressão) — usar Overview
   como piloto na próxima.

## Escopo desta rodada

Não tenho permissão de escrita no GitHub (só leio/comparo/copio DE lá). Este é o pacote
completo pra aplicar no `renault-tech/Investiq` — via Claude Code ou um dev, apontando pra
este projeto Omelette (o design em `InvestIQ Wealth OS.dc.html`) e pra esta pasta
(`handoff/`, código pronto nos caminhos exatos do repo).

## Como executar

1. Abrir o Claude Code na raiz do repo clonado.
2. Apontá-lo para este projeto Omelette como referência visual (cores, ícones, textos,
   gráficos do `.dc.html`) e para `handoff/` como código pronto a copiar.
3. Aplicar nesta ordem (cada item é independente, sem dependência entre si):
   a. `apps/api/src/cards/analytics.py` + aditivos em `schemas.py`/`router.py` → analytics de fatura.
   b. `apps/api/src/actions/*` (módulo novo) + registrar em `main.py` → Central de Ações (backend).
   c. `apps/web/src/components/cards/InvoiceAnalytics.tsx` + aditivos em `cards-api.ts`/`useCards.ts` → analytics de fatura (front).
   d. `apps/web/src/components/layout/ActionCenterDropdown.tsx` + aditivos em `actions-api.ts`/`useActions.ts` → Central de Ações (front), integrar em `TopBar.tsx` ao lado de `NotificationsDropdown`.
   e. `apps/web/src/components/finances/TransactionsTable.tsx` (substituição direta) → sort + seleção múltipla + ações em lote.
   f. `apps/web/src/components/layout/CommandPalette.tsx` + integração em `PlatformShell.tsx` → busca global ⌘K.
4. Rodar `pytest tests/unit -q` (api) e `npm run build`/`npx tsc --noEmit` (web) — coisas que
   eu não consigo executar daqui.

## Decisão: importação de fatura — mantive o pipeline do servidor

Já implementado assim no repo; não troquei por parsing local. Ver comparação completa na
seção anterior deste README (histórico da rodada passada) — resumo: servidor com IA é mais
preciso em fatura real, reaproveita a categorização aprendida entre faturas/dispositivos, e a
chave de IA do usuário nunca sai do servidor; local seria mais privado mas não dá pra chamar
IA com segurança do navegador nem reaproveitar o aprendizado.

## Mapa de tokens — `.dc.html` (mock) → `globals.css` (real)

O mock usa uma paleta própria; o repo já tem a dele (documentado em `globals.css` como
handoff "InvestIQ Wealth OS" 2026-08-10 — praticamente o mesmo sistema, nomes diferentes).
**Usar sempre os tokens reais abaixo, nunca os do `.dc.html`:**

| `.dc.html` | `globals.css` (real) | Uso |
|---|---|---|
| `--bg` | `--background` | fundo da página |
| `--elev` / `--rail` | `--surface` | cards, sidebar, dropdowns |
| (sem equivalente) | `--surface-2`, `--surface-3` | hover e fundo elevado (2 níveis, o mock só tem 1) |
| `--ink` | `--text-primary` | texto principal |
| `--ink3` | `--text-secondary` | texto secundário |
| `--ink4` | `--text-muted` | texto terciário/placeholder |
| `--accent` | `--accent` | cor de destaque — **no repo é customizável pelo usuário** (Configurações → Aparência, 6 opções); nunca hardcode um hex |
| (sem equivalente) | `--accent-2` | segunda cor de destaque (índigo), usada em gradientes/CDI |
| `--pos-ink` | `--accent` | valores positivos, ganho |
| `--neg-ink` | `--danger` | valores negativos, perda, urgência |
| `--warn-ink` | `--warning` | atenção, pendência |
| `--violet-ink` | `--accent-2` | ênfase secundária |
| `--ln1/2/3` | `--border` / `--border-strong` | bordas (repo só tem 2 pesos, não 3) |
| (sem equivalente) | `--chart-portfolio/cdi/ibov/nasdaq/sp500` | paleta fixa de gráfico — **nunca usar `--accent` num gráfico de série**, é deliberadamente desacoplada |
| (sem equivalente) | `--glow` | derivado de `--accent` via `color-mix`, usado em halos/destaques |
| `--radius-*` (vários) | `--radius-card` (24px) / `--radius-card-sm` (20px) / `--radius-pill` (11px) | só 3 tamanhos no repo, não um por elemento |

## Ícones — usar lucide-react, nunca glifo/emoji

O mock usa glifos unicode (`◍`, `◧`, `✓`...) só porque HTML solto não carrega uma lib de
ícone. O repo inteiro usa `lucide-react` — ao portar cada tela, trocar todo glifo pelo
ícone lucide mais próximo semanticamente (a maioria já apareceu nos arquivos lidos: `Bell`,
`Inbox`, `Clock`, `AlertCircle`, `FileWarning`, `Tag`, `CreditCard`, `TrendingUp`, `Wallet`,
`ArrowLeftRight`, `Target`, `Repeat`, `CheckCircle2`, `Trash2`, `Pencil`, `Upload`, `Search`).
Tamanho padrão do repo: 13–17px (nunca os ~24px+ do mock).

## Gráficos — dois sistemas coexistem, seguir o que a tela já usa

- **Barras/donut simples** (evolução, alocação, fluxo, fatura mês a mês): `<div>` com
  `height`/`width` calculados e `animate-grow-y`/`animate-rise-up` — ver `AreaLineChart.tsx`,
  `DonutRing.tsx`, `CardsClient.tsx` (billBars). Leve, sem dependência.
- **Séries com eixo/tooltip/zoom** (benchmark, candlestick): Recharts — ver
  `BenchmarkChart.tsx`, `CandlestickChart.tsx`. Usar Recharts só quando a tela já usa (não
  introduzir a lib numa tela que hoje é `<div>` simples).
- Nenhum gráfico novo deve reintroduzir SVG desenhado à mão (o `.dc.html` tem alguns
  sparklines em `<path>` cru) — portar pra um dos dois sistemas acima.

## Pacote completo desta rodada (layout daqui, base de lá)

1. Base: `globals_tokens.css`, `Sidebar.tsx`, `TopBar.tsx` + `useMarketTicker.ts`
2. `overview/OverviewClient_patch.md` — gráfico SVG, anel de saúde financeira, barras de fluxo
3. `cards/CardsClient_patch.md` — cartão visual, barra de limite, selos de confiança
4. `finances/Finances_patch.md` — card de gasto consolidado, orçamento por categoria, donut
5. `investments/InvestmentsClient_patch.md` — hero + alocação + rebalanceamento real
6. `trader/Trader_patch.md` — chrome (mantém candlestick real, não rebaixar)
7. Transações — `TransactionsTable.tsx` (rodada anterior) + pills de filtro (neste README)
8. `goals/Goals_patch.md` — lista de metas + `FireSimulator.tsx` (novo, cálculo real)
9. `settings/Settings_Reports_Help_patch.md` — Relatórios/Configurações/Ajuda

Todas as 10 telas de conteúdo + o chrome estão cobertos. Aplicar na ordem 1→9.

## Status por tela (auditoria completa)

| Tela/feature do `.dc.html` | Componente real | Status |
|---|---|---|
| Visão geral | `OverviewClient.tsx` | Já existe, mais completo (drag-to-resize, hide/restore card, titular unificado) |
| Cartões — upload/revisão | `CardsClient.tsx` + `apps/api/src/cards/*` | Já existe |
| Cartões — analytics pós-fatura | — | **Construído**: `handoff/apps/api/src/cards/analytics.py`, `InvoiceAnalytics.tsx` |
| Escopo consolidado / titular | `holders.ts`, `Portfolio.holder` | Já existe (contas + carteiras unificadas) |
| Benchmark no gráfico de retorno | `BenchmarkChart.tsx` | Já existe |
| Transações — sort + seleção em lote ("Pro tables") | `TransactionsTable.tsx` | **Construído**: `handoff/.../TransactionsTable.tsx` (substituição) |
| Central de Ações (inbox priorizado) | `NotificationsDropdown.tsx` (é só alerta simples, não é isto) | **Construído**: `handoff/apps/api/src/actions/*`, `ActionCenterDropdown.tsx` |
| Busca global ⌘K | — | **Construído**: `handoff/.../CommandPalette.tsx` |
| Tema claro/escuro | `globals.css` (`.dark`) | Já existe, mais completo (accent customizável) |
| Impostos & IR — apuração separada por titular/CPF | — | **Não construído** — repo não tem módulo de IR/DARF algum; é feature nova, precisa de escopo próprio (o que é evento tributável, alíquota por prazo, DARF por competência) antes de codar |

## Transações — já resolvido na rodada anterior

`handoff/apps/web/src/components/finances/TransactionsTable.tsx` (sort + seleção múltipla +
ações em lote) é a substituição completa da tabela. Falta só o resto do shell da tela
(`TransactionsClient.tsx`): trocar os filtros de tipo (hoje talvez `<select>` ou botões
simples) pelos pills do design —

```tsx
<div className="flex items-center gap-2 flex-wrap">
  {FILTERS.map((f) => (
    <button
      key={f.value}
      onClick={() => setFilter(f.value)}
      className="px-3 py-1.5 rounded-[9px] text-[12px] font-medium transition-colors"
      style={{ background: filter === f.value ? "var(--surface-3)" : "var(--surface-2)", color: filter === f.value ? "var(--text-primary)" : "var(--text-secondary)", border: "1px solid var(--border)" }}
    >
      {f.label}
    </button>
  ))}
</div>
```

`FILTERS` = mesmos valores que a tela já usa para filtrar `useTransactions` (tipo, conta,
cartão) — só a apresentação (pill em vez de outro controle) muda.

## Trader — ver `handoff/apps/web/src/components/trader/Trader_patch.md`

## O que NÃO portar do `.dc.html`

- Qualquer cor hex literal (usar a tabela de tokens acima).
- Qualquer glifo unicode como ícone (usar lucide).
- A estrutura de "seletor de carteira" do mock — o real (`holders.ts` + `select` nativo) já
  resolve o mesmo problema de forma mais simples; não recriar o dropdown customizado do mock.
- O card "Guardar também o PDF original (criptografado)" — decisão de produto não tomada
  ainda no repo real (hoje raw_text fica no banco, sem opção de descartar); se quiser esse
  controle, é uma decisão de retenção de dados a tomar antes de codar, não um simples toggle de UI.
