# Fase 8 — Finanças avançadas: de "registro de gastos" a planejamento financeiro

**Objetivo:** completar o módulo de finanças pessoais da Fase 3 com o que separa uma
ferramenta de anotação de uma de planejamento: contas por banco/titular, transferências,
parcelamentos, importação de extrato, categorização que aprende, projeção de fluxo de
caixa, análises avançadas e exportação — sem virar um monstro. **Completo, não complexo.**

**Dependências:** Fase 3 (finance base), Fase 1 (charts). **Status:** ✅ Completo — 10 blocos, todos commitados na branch `claude/investment-platform-roadmap-8iet5x`.

---

## O que foi construído

### Bloco 1 — Contas (a fundação)

`bank_accounts` (já existia, migração 0002, mas era código morto) ganhou `holder`,
`color`, `icon`, `include_in_total`, `portfolio_id`, `archived_at` e RLS (migração `0011`).
**Saldo é derivado, nunca armazenado** — uma query única soma `amount_brl` de todas as
transações da conta (`income` soma, `expense`/`transfer` de origem subtrai, `transfer` de
destino soma), filtrando `transaction_date <= NOW()` para que parcelas futuras já
materializadas não inflem o saldo de hoje. `AccountsBar.tsx` no topo de `/finances` filtra
a página inteira por titular — sem segundo nível de "perfil".

### Bloco 2 — Transferências e aportes

`to_bank_account_id` em `financial_transactions`: uma linha, dois FKs — não duas linhas
espelhadas. `get_summary` ignora `transfer` inteiramente (mover dinheiro entre contas do
mesmo dono não é receita nem despesa). Conta com `account_type='investment'` pode apontar
para um `portfolio_id`; transferência para ela é um aporte.

### Bloco 3 — Parcelamentos

`installment_group_id`/`installment_no`/`installment_total` (mesmos nomes que
`invoice_items` já usava para faturas). Uma compra parcelada **materializa N linhas**, não
expande virtualmente — `is_recurring=False` as mantém fora de `expand_recurring` e elimina
qualquer risco de contagem dupla. A última parcela absorve o resto dos centavos.

### Bloco 4 — Importação de extrato

`source` (`manual|import_ofx|import_csv|card_invoice|installment`) e `external_id`
(o `FITID` do OFX, índice único parcial por usuário) em `financial_transactions` — todo
lançamento manual fica visivelmente marcado como tal na tabela. Parser OFX 1.x (SGML) e
2.x (XML) via `xml.etree` da stdlib, sem dependência nova. Dedupe em dois níveis:
`external_id` igual bloqueia (duplicata certa); mesma conta+valor+data±3 dias+descrição
parecida vem desmarcada na tela de revisão (duplicata provável).

### Bloco 5 — Categorização automática que aprende

`finance_category_rules`: normalização do estabelecimento (`merchant_key` — tira acentos,
prefixos de operação como "PIX ENVIADO"/"COMPRA CARTAO", datas, sequências de dígitos) e
precedência regra-do-usuário → regra-aprendida → sugestão de IA. Digitar uma transação com
descrição e categoria já treina a regra — a próxima vez que a mesma loja aparecer, vem
categorizada. IA é sempre sob demanda (`POST /finance/categorize/suggest`,
`10/hour`), nunca embutida na importação.

### Bloco 6 — Projeção de fluxo de caixa

`GET /finance/forecast?months=6` decompõe cada mês futuro em **comprometido** (recorrência
expandida + parcelas já materializadas + faturas em aberto) e **estimado** (mediana dos
últimos 6 meses fechados, por categoria sem cobertura conhecida — mediana em vez de média
para um pagamento anual isolado não distorcer a estimativa). `negative_from` aponta o
primeiro mês em que o saldo acumulado fica negativo.

### Bloco 7 — Análises avançadas

`GET /finance/analytics?months=6`: burn rate (despesa média 3 meses), taxa de poupança,
fôlego (saldo ÷ burn rate, em meses), tendência por categoria (gasto do mês vs. mediana de
6 meses) e matriz categoria×mês. Tudo derivado dos mesmos dados já carregados.

### Bloco 8 — Exportação e Vercel

Exportação OFX 2.x (par inverso do parser de importação, também stdlib pura) e CSV
enriquecido com conta, moeda, origem e parcela. `reports` (relatório PDF mensal, via
`fpdf2`) e `cards` voltam a rodar na Vercel — só o `pdfplumber` do upload de PDF de fatura
é pesado o bastante para estourar o teto de 225MB, e seu import já era preguiçoso.

> Atualização: `pdfplumber` foi substituído por `pypdf` (puro Python, ~4MB, sem a
> cadeia fontTools/pypdfium2) — o upload de PDF de fatura também funciona na Vercel agora.

### Bloco 9 — Gancho de multimoeda e acabamento

Todas as agregações (`get_summary`, orçamento, projeção, análises) somam `amount_brl` em
vez de `amount` cru — fecha um bug latente que misturaria moedas em silêncio no dia em que
uma transação estrangeira existisse. `_get_fx_rates_to_brl` sai de `portfolio/service.py`
para `shared/fx.py` e passa a ser reusado na escrita: sem `fx_rate` explícito e moeda
diferente de BRL, trava a cotação real do dia em vez de assumir 1:1. `_month_spend_for_category`
deixa de ser SQL puro (não via recorrência virtual) e passa a usar `list_transactions`, o
mesmo caminho de `get_summary` — orçamento e resumo do mês param de divergir.
`list_budgets` deixa de fazer uma query por orçamento (N+1). `CategoryManager` migra para
o primitivo `ui/Modal`; formulários de orçamento e meta migram para `Input`/`Select`/`Button`.

### Bloco 10 — Arquitetura de rotas e testes

`FinanceTabs` (layout via route group `(tabs)`) consolida a navegação entre Visão geral,
Planejamento, Análise financeira e Importar — `/finances/cards` fica fora do grupo,
inalterado, continua acessível pelo item "Cartões" da sidebar. Cobertura de isolamento
entre usuários (RLS de aplicação) estendida para `bank_accounts` e `finance_category_rules`.

---

## Decisões que não mudam

1. **Contas = lista plana com titular**, não um segundo nível de "perfil".
2. **Sem multiusuário real** — um login só; o modelo não fecha a porta, mas nada de convites/RLS de sessão.
3. **Import é OFX + CSV**, com revisão antes de confirmar; lançamento manual continua existindo e fica marcado como tal.
4. **Multimoeda é só o gancho** — `currency`/`fx_rate`/`amount_brl` corretos desde a escrita, sem UI de moeda estrangeira.

---

## Verificação

- **Backend:** 193 testes (`pytest`), incluindo RLS de `bank_accounts`/`finance_category_rules`, round-trip do parser/exportador OFX, mediana resistindo a outlier na projeção e na tendência por categoria, orçamento enxergando recorrência virtual.
- **Frontend:** `tsc --noEmit` e `next build` limpos; `playwright test` (auth, finances, investments) verde.
- **Manual/visual:** cada bloco verificado com Playwright contra servidores reais — pegou bugs que os testes automatizados não cobriam (contagem dupla do dia corrente na projeção, relacionamento `category` desatualizado após atribuir `category_id` cru, strings Decimal não convertidas na UI de análises).
