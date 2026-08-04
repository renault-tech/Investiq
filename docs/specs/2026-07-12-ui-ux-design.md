# Spec: Planejamento UI/UX — InvestIQ

**Data:** 2026-07-12
**Base:** design system "Investiq Institutional" (`../superpowers/specs/2026-03-24-design-system-and-analysis-page.md`) — tokens, paleta navy/emerald, Manrope, light default + dark. Este documento complementa a spec de tokens com **arquitetura de informação, wireframes e padrões de interação** para todas as telas do roadmap.

---

## 1. Fundamentos

**Persona:** investidor pessoa física brasileiro que gerencia a própria carteira (B3 + exterior + renda fixa) **e** quer controlar gastos pessoais no mesmo lugar. Confortável com números; espera densidade de informação, não infantilização.

**Princípios:**
1. **O número antes da decoração** — KPIs e P&L são os protagonistas; gráficos suportam a leitura, não competem com ela.
2. **Hierarquia por tipografia e cor, não por caixas** — Manrope 600/700 para valores, Geist Mono para números tabulares; `--accent` = positivo, `--danger` = negativo, sempre.
3. **Light institucional como padrão; dark para análise gráfica** — o usuário de candlestick tende ao dark; ambos impecáveis.
4. **Nada de beco sem saída** — toda tela vazia tem CTA; todo erro tem próximo passo; toda ação longa tem feedback.
5. **Mobile é leitura, desktop é operação** — no mobile prioriza-se consultar (saldos, gráficos, notificações); operações complexas (revisão de fatura, rebalance) otimizadas para desktop mas possíveis no mobile.

---

## 2. Sitemap / navegação

```
/                          Landing (público; autenticado → redirect /investments)
/(auth)/login|register|forgot-password
/(platform)                Shell: Sidebar + TopBar + BottomNav(mobile)
├── /investments           Dashboard de carteiras (default pós-login)
│   └── /investments/[ticker]   Página do ativo
├── /analysis              Análise IA de carteira (histórico + relatório + chat)
├── /finances              Dashboard de gastos
│   └── /finances/cards    Cartões e faturas
└── /settings              Perfil, aparência, dados, IA, dispositivos (bridge)
```

**Sidebar (desktop):** Investimentos, Análise, Finanças, Cartões, Configurações — ícone + label, item ativo `bg-[var(--navy)] text-white rounded-lg`. Rodapé: avatar, nome, plano.

**TopBar:** logotipo (esq.) → **busca global de ticker** (centro; autocomplete via endpoint de search; enter → `/investments/[ticker]`) → zoom (fontScale) | toggle tema | sino de notificações (badge) | avatar com menu (settings, logout).

**BottomNav (mobile <768px):** 5 itens: Carteira, Análise, Finanças, Cartões, Config. Sidebar oculta.

---

## 3. Wireframes textuais (telas-chave)

### 3.1 `/investments` — dashboard de carteiras
```
[PortfolioTabs: Carteira BR | Internacional | + Nova]
┌ Visão Geral ──────────────────────────────────────────────┐
│ [PortfolioEvolutionChart — área, período 1m|3m|6m|1y|max] │
│ [AllocationDonut por tipo ▾/ativo]  [KPIs: valor, P&L R$, │
│                                      P&L %, aporte total] │
└───────────────────────────────────────────────────────────┘
[PositionsTable: ticker(link) | qty | PM | preço | valor | P&L | peso | rebalance tag | ações]
[+ Nova posição] [+ Transação]                    [atualizado às HH:MM ↻]
```
- KPIs migram do LeftPanel atual para cards horizontais acima da tabela em telas largas (avaliar na implementação; manter LeftPanel se o grid ficar apertado).
- Aba "Proventos" (Fase 7) ao lado de "Posições".

### 3.2 `/investments/[ticker]` — página do ativo
```
[AssetHeader: PETR4 · Petrobras PN   R$ 38,42  +1,2% ▲   (badge Ação B3)  [Analisar com IA]]
┌ Gráfico ─────────────────────────────────────────────────┐
│ [toolbar: 1m 3m 6m 1a 5a max | 1d 1s | ☑SMA ☑EMA ☐Boll  │
│  ☐RSI ☐MACD]                                             │
│ [CandlestickChart + volume]                              │
│ [pane RSI] [pane MACD]  (quando ligados)                 │
└──────────────────────────────────────────────────────────┘
[FundamentalsGrid: P/L · P/VP · DY · ROE · Margem · MarketCap · 52w ▲▼ — cards 4/linha, "—" se indisponível]
[AssetAiPanel: análise streamada + chat de follow-up]
[Posição na carteira (se houver): qty, PM, P&L]  [Alertas de preço (Fase 7): lista + novo]
```

### 3.3 `/analysis`
Mantém a estrutura atual (sidebar de histórico + relatório em seções + chat), com os componentes migrados para os primitivos `ui/` e skeleton de streaming.

### 3.4 `/finances`
```
[MonthPicker ◄ Julho 2026 ►]           [+ Nova transação] [Categorias] [Exportar]
[SummaryCards: Receitas | Despesas | Saldo  (+var% vs mês anterior)]
┌──────────────────────────┬────────────────────────────────┐
│ ExpensesByCategoryDonut  │ MonthlyFlowChart (12m, barras) │
└──────────────────────────┴────────────────────────────────┘
[Orçamentos (Fase 7): barras de progresso por categoria]
[TransactionFilters: tipo | categoria | busca | tags]
[TransactionsTable paginada: data | descrição | categoria(chip) | valor ±cor | ⟳recorrente | ⋮]
```

### 3.5 `/finances/cards` — fluxo de fatura
```
[CreditCardList: cards visuais — Nubank •••• 1234 | fecha dia 3, vence dia 10 | + Novo]
── selecionado ──
[InvoiceUploadZone: arraste o PDF/CSV da fatura]
[Lista de faturas: Jun/26 confirmada ✓ | Jul/26 em revisão ⚠]
── fatura em revisão ──
[InvoiceReviewTable: ☑ | descrição | data | parcela | valor | categoria(select, destaque se vazio) | ignorar]
[InvoiceConfirmBar sticky: 42 itens · R$ 3.412,88 · [Confirmar fatura]]
```
Estados do upload: enviando (progress) → `processing` ("IA extraindo lançamentos…", skeleton de linhas) → `review` / `failed` (mensagem + tentar novamente).

### 3.6 `/settings`
Seções em navegação lateral interna (ou accordion no mobile): **Perfil** (nome, email, senha) · **Aparência** (tema, escala de fonte) · **Dados de mercado** (provider preferido, chave Brapi) · **Inteligência artificial** (provider, modelo, chaves mascaradas write-only) · **Dispositivos** (tokens do Profit Bridge, quando implementado) · **Notificações** (email on/off).

### 3.7 Landing (`/`)
Hero navy full-bleed (headline: consolide investimentos e gastos com análise inteligente) → screenshot do dashboard → 3–4 features em cards (carteira B3+global, análise técnica/fundamentalista, IA com a sua chave, faturas com IA) → CTA registro → footer. Sem carrossel, sem animação pesada; Lighthouse ≥ 90.

---

## 4. Padrões de interação

| Padrão | Regra |
|---|---|
| **Loading** | Skeleton (`ui/Skeleton`) na primeira carga; spinners só em botões. Nunca layout shift: skeleton com as dimensões do conteúdo final. |
| **Empty state** | `ui/EmptyState`: ícone lucide + título + 1 linha de descrição + CTA primário (ex.: "Nenhuma posição ainda — Adicionar posição"). |
| **Erros** | Toast (sonner) para ações; inline para formulários; página de erro com retry para falha de carga. Mensagens em PT-BR, sem stack trace. |
| **Modais** | `ui/Modal`: overlay, ESC/click-fora fecha (com confirmação se form sujo), scroll interno, foco preso, `aria-labelledby`. Máx. 1 nível. |
| **Formulários** | Validação inline no blur + no submit; botão desabilitado durante submit com spinner; valores monetários com máscara BRL. |
| **Tabelas** | Ordenação por coluna (client-side até ~200 linhas; server-side paginado acima); ações por linha em menu `⋮`; linha clicável quando há detalhe (ticker → página do ativo). |
| **Confirmações** | Ações destrutivas (excluir portfólio/transação/fatura) → dialog de confirmação com nome do objeto. |
| **Números** | Geist Mono, alinhados à direita em tabelas; BRL `R$ 1.234,56`; percentual `+1,23%` com sinal e cor; datas `dd/mm/aaaa`. |

**Responsividade (breakpoints Tailwind):** `<768px` BottomNav + colunas empilham + tabelas em scroll horizontal contido (ou cards-lista para transações); `768–1024` sidebar colapsada em ícones; `>1024` layout completo. Nenhuma rota pode ter overflow horizontal do body.

**Acessibilidade:** contraste AA garantido pelos tokens (validar `--text-muted` sobre `--surface` nos dois temas); foco visível (`outline` navy/emerald); toda ação por ícone tem `aria-label`; modais e dropdowns navegáveis por teclado; gráficos com resumo textual (`aria-label` com valor total/variação) já que canvas/SVG não são lidos.

---

## 5. Diretrizes de dataviz

1. **Cores semânticas fixas:** positivo/receita = `--accent`; negativo/despesa = `--danger`; neutro/benchmark = `--navy`; grades e eixos = `--border`/`--text-muted`. Categorias de gastos usam o `color` da própria categoria.
2. **Candlestick:** alta emerald / baixa red (tokens), volume em barras com 40% de opacidade, indicadores sobrepostos em cores distintas e discretas (SMA slate, EMA amber, Bollinger preenchimento 8%).
3. **Tooltips padronizados:** fundo `--surface`, borda `--border`, valores formatados BRL/%, data por extenso curta ("12 jul 2026").
4. **Donut:** máx. 8 fatias — agregar o resto em "Outros"; legenda com valor e %, nunca só cor.
5. **Sem 3D, sem gradientes chamativos** (exceto o fill sutil do AreaChart de evolução), sem animação > 300ms.
6. **Dark mode:** verificar cada gráfico nos dois temas — cores derivadas de tokens via `getComputedStyle`, nunca hex fixo no JSX.

---

## 6. Ordem de aplicação

Este documento guia: Fase 1 (charts do dashboard), Fase 2 (página do ativo), Fase 3 (finanças), Fase 4 (fluxo de fatura) e principalmente a **Fase 5** (auditoria de tokens, primitivos `ui/`, landing, settings, polish transversal). Critérios de verificação visuais estão nas specs de cada fase.
