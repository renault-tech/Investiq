# Fase 5 — Design system completo, landing page e settings

**Objetivo:** aplicar a spec "Investiq Institutional" (`docs/superpowers/specs/2026-03-24-design-system-and-analysis-page.md`) em 100% do app, criar a landing page e a tela de configurações. Resultado visual "profissional, alto nível". Detalhes de UI/UX em `../specs/2026-07-12-ui-ux-design.md`.

**Dependências:** Fases 0–2 (telas de investimentos existentes); pode rodar em paralelo às Fases 3/4. **Grão:** 2 sessões.

---

## Tarefas

### 5.1 — Auditoria e migração de tokens

- Varrer `apps/web/src` por classes hardcoded: `bg-neutral-*`, `bg-blue-600`, `hover:bg-blue-700`, `text-neutral-*` (ex.: `InvestmentsClient.tsx:56-70`) e migrar para os tokens da spec (`var(--surface)`, `var(--navy)`, `var(--accent)`, `var(--text-*)`, `var(--border)`).
- Conferir `globals.css` e `layout.tsx` contra as seções 1.1–1.4 da spec: paleta completa light/dark, **Manrope** via `next/font/google` (`--font-manrope`), Geist Mono mantida para números/métricas, light como default (`<html>` sem `.dark`), `theme-color` `#0A192F`, `ThemeProvider` do next-themes com `defaultTheme="light"`.

### 5.2 — Biblioteca de primitivos `apps/web/src/components/ui/`

Criar e refatorar as telas existentes para usá-los:
- `Button.tsx` — variants `primary` (navy), `secondary` (emerald outline), `ghost`, `danger`; tamanhos sm/md; estado loading.
- `Input.tsx`, `Select.tsx` — label, erro inline, `htmlFor` correto.
- `Modal.tsx` — **consolidar os 3 modais de investments** (`NewPortfolioModal`, `AddPositionModal`, `NewTransactionModal`) que hoje repetem estrutura (overlay, esc/close, scroll interno).
- `Badge.tsx`, `Skeleton.tsx`, `EmptyState.tsx` (ícone + título + descrição + CTA), `Card.tsx` (surface + border + radius + shadow-sm no light).

### 5.3 — Landing page

**Substituir `apps/web/src/app/page.tsx`** (hoje template do create-next-app):
- Server Component puro, sem JS pesado; usuário autenticado → redirect para `/investments`.
- Hero navy com headline PT-BR + subheadline; mock/screenshot do dashboard.
- Seções de features: consolidação de carteira B3/global, análise técnica+fundamentalista, IA multi-provider (você usa sua própria chave), controle de gastos e faturas com IA.
- CTA login/registro; footer simples.

### 5.4 — Settings UI

**Substituir o stub** `apps/web/src/app/(platform)/settings/page.tsx` → `apps/web/src/components/settings/SettingsClient.tsx`, seções:
- **Perfil:** nome, email, troca de senha (verificar endpoints disponíveis em `src/auth/router.py`; criar `PATCH /auth/me` no backend se necessário).
- **Aparência:** tema light/dark (next-themes), escala de fonte (já existe no store).
- **Provedor de dados:** yahoo/brapi (`preferred_provider`) + `brapi_key`.
- **IA:** `preferred_llm`, `llm_model`, chaves Claude/OpenAI/Gemini com **input mascarado write-only** (nunca exibir a chave salva; a API já existe: `GET/PATCH /settings`, `PUT /settings/api-keys`).

**Novos:** `apps/web/src/lib/settings-api.ts`, `apps/web/src/hooks/useSettings.ts`.

### 5.5 — Polish transversal

- Empty states com CTA em todas as listas (posições, análises, transações, faturas).
- Skeletons de loading consistentes (`Skeleton.tsx`) em todas as queries.
- Toasts (sonner) padronizados: sucesso curto, erro com ação quando aplicável.
- TopBar conforme spec: logotipo à esquerda, **busca global de ticker** (autocomplete → navega para `/investments/[ticker]`), zoom discreto, toggle de tema, sino (placeholder até a Fase 7), avatar.
- Responsivo revisado página a página; `BottomNav.tsx` cobrindo todas as rotas novas (Investimentos, Análise, Finanças, Cartões, Config).
- Favicon/manifest PWA com a marca (navy/emerald).

---

## Critérios de verificação

- [ ] `grep -r "bg-neutral-\|bg-blue-" apps/web/src --include="*.tsx"` → zero ocorrências fora de `components/ui/`.
- [ ] Light/dark consistentes em todas as rotas; toggle persiste entre sessões.
- [ ] `/` renderiza a landing (Lighthouse ≥ 90 em performance e a11y); logado, `/` redireciona para `/investments`.
- [ ] Settings: salvar chave de IA e gerar análise com o provider escolhido funciona end-to-end; chave nunca aparece em GET.
- [ ] Busca global: digitar "PETR" → sugestões → enter abre a página do ativo.
- [ ] Navegação mobile 375px sem overflow horizontal em nenhuma rota.
