/** Central de Ações no TopBar: badge, conteúdo, contraste e — o que mais
 * importa num inbox — sumir sozinha quando a pendência é resolvida. */
import { test, expect, Page } from "@playwright/test";
import { registerAndLogin, dismissTourIfPresent } from "./helpers";

function isoDaysFromToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10) + "T12:00:00Z";
}

/** O access token vive só numa variável de módulo do api-client, fora do
 * alcance de page.evaluate. O refresh token, esse sim, é cookie httpOnly —
 * então dá pra trocar por um access token novo de dentro da página. */
async function tokenDaSessao(page: Page): Promise<string> {
  const token = await page.evaluate(async () => {
    const res = await fetch("http://localhost:8000/api/v1/auth/refresh", {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) return null;
    return (await res.json()).access_token as string;
  });
  expect(token, "não foi possível obter access token pelo refresh cookie").toBeTruthy();
  return token as string;
}

/** Conta a pagar em aberto, criada pela API porque o modal da UI não expõe
 * vencimento. Vencimento no passado nasce marcado como pago
 * (create_transaction assume `paid = due <= now`), então é preciso desmarcar
 * para ter uma conta de fato vencida — que é o caso do topo do inbox. */
async function criarConta(
  page: Page,
  { amount, description, dueInDays }: { amount: number; description: string; dueInDays: number }
) {
  const token = await tokenDaSessao(page);
  const created = await page.evaluate(
    async ([token, amount, description, iso]) => {
      const res = await fetch("http://localhost:8000/api/v1/finance/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({
          transaction_type: "expense", amount, description,
          transaction_date: iso, due_date: iso,
        }),
      });
      return { status: res.status, body: await res.json() };
    },
    [token, amount, description, isoDaysFromToday(dueInDays)] as const
  );
  expect(created.status, JSON.stringify(created.body)).toBe(201);

  if (created.body.is_paid) {
    const un = await page.evaluate(
      async ([token, id]) => {
        const res = await fetch(`http://localhost:8000/api/v1/finance/transactions/${id}/unpay`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
        return res.status;
      },
      [token, created.body.id as string] as const
    );
    expect(un).toBe(200);
  }
  return created.body.id as string;
}

const BADGE = 'button[aria-label^="Central de ações"] span';
const BOTAO = 'button[aria-label^="Central de ações"]';

/** Tudo do dropdown tem que ser buscado DENTRO dele: os mesmos lançamentos
 * aparecem nos cards da Visão geral, e uma busca solta vira strict mode
 * violation assim que o painel de trás termina de carregar. */
function painel(page: Page) {
  return page.locator("div.relative", { has: page.locator(BOTAO) });
}

test("inbox lista as pendências priorizadas e o badge conta certo", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await registerAndLogin(page);

  // Vazio primeiro: o botão existe e não tem badge.
  await expect(page.locator(BOTAO)).toBeVisible();
  await expect(page.locator(BADGE)).toHaveCount(0);
  await page.locator(BOTAO).click();
  await expect(painel(page).getByText("Tudo em dia — nenhuma pendência.")).toBeVisible();
  await page.locator(BOTAO).click();

  await criarConta(page, { amount: 5000, description: "Grande a vencer", dueInDays: 5 });
  await criarConta(page, { amount: 1000, description: "Pequena vencida", dueInDays: -2 });

  await page.reload();
  await dismissTourIfPresent(page);
  await expect(page.locator(BADGE)).toHaveText("2", { timeout: 15_000 });

  await page.locator(BOTAO).click();
  const titulos = await painel(page).locator("ul li p.font-medium").allInnerTexts();
  // Vencida acima da a-vencer mesmo valendo menos — a ordenação vem do backend.
  expect(titulos).toEqual(["Pequena vencida", "Grande a vencer"]);
  // Valor exato, não compacto: num inbox de contas o centavo é o que
  // decide o que pagar primeiro.
  await expect(painel(page).getByText("R$ 6.000,00 pendente")).toBeVisible();
});

test("pagar a conta esvazia o inbox sem recarregar a página", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await registerAndLogin(page);
  await criarConta(page, { amount: 300, description: "Luz", dueInDays: -1 });

  await page.reload();
  await dismissTourIfPresent(page);
  await expect(page.locator(BADGE)).toHaveText("1", { timeout: 15_000 });

  // Paga em Transações, pela UI. Sem a invalidação de ["actions"] nas
  // mutações de finanças, o badge continuaria mostrando 1.
  await page.goto("/transactions");
  await dismissTourIfPresent(page);
  // O aria-label vence o texto visível "Pagar" como nome acessível.
  await page.getByRole("button", { name: "Marcar Luz como paga" }).click();

  await expect(page.locator(BADGE)).toHaveCount(0, { timeout: 15_000 });
  await page.locator(BOTAO).click();
  await expect(painel(page).getByText("Tudo em dia — nenhuma pendência.")).toBeVisible();
});

test("clicar num item leva para a tela que resolve a pendência", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await registerAndLogin(page);
  await criarConta(page, { amount: 120, description: "Internet", dueInDays: -3 });

  await page.reload();
  await dismissTourIfPresent(page);
  await page.locator(BOTAO).click();
  await painel(page).getByText("Internet").click();

  await expect(page).toHaveURL(/\/transactions/);
});

test("badge passa em contraste AA nos dois temas", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await registerAndLogin(page);
  await criarConta(page, { amount: 50, description: "Água", dueInDays: -1 });
  await page.reload();
  await dismissTourIfPresent(page);
  await expect(page.locator(BADGE)).toHaveText("1", { timeout: 15_000 });

  async function medir() {
    const theme = await page.evaluate(() => document.documentElement.className || "system");
    const ratio = await page.evaluate((sel) => {
      const lum = (c: string) => {
        const [r, g, b] = c.match(/[\d.]+/g)!.map(Number).slice(0, 3).map((v) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const el = document.querySelector(sel) as HTMLElement;
      const l1 = lum(getComputedStyle(el).color);
      const l2 = lum(getComputedStyle(el).backgroundColor);
      const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
      return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
    }, BADGE);
    // 9px não conta como texto grande: o mínimo é 4,5:1, não 3:1.
    expect(ratio, `badge em tema ${theme}: ${ratio}:1`).toBeGreaterThan(4.5);
    return theme;
  }

  const primeiro = await medir();
  await page.getByTitle("Alternar tema").click();
  await expect.poll(() => page.evaluate(() => document.documentElement.className)).not.toBe(primeiro);
  await page.waitForTimeout(500);
  await medir();
});

test("logout limpa o cache e o próximo login na mesma aba entra limpo", async ({ page }) => {
  // Faz dois ciclos de autenticação e volta pra /overview duas vezes; com a
  // suíte inteira em paralelo o dev server ainda compila rota sob demanda,
  // então este é naturalmente mais lento que os vizinhos.
  test.setTimeout(90_000);
  // O logout usa router.push, que é navegação client-side: o QueryClient da
  // raiz sobrevive. Sem limpá-lo, duas coisas dão errado, e este teste falha
  // se a limpeza for removida:
  //   1. as queries do usuário anterior continuam montadas e refazendo
  //      busca; elas passam a tomar 401, o interceptor tenta renovar, falha
  //      e manda um window.location para /login — que recarrega a página no
  //      meio do formulário e impede o próximo login de concluir (é aqui
  //      que ele falha primeiro, sem a correção);
  //   2. dentro da janela de staleTime, o TopBar do usuário B seria servido
  //      do cache de A — títulos e valores de contas alheias. As duas
  //      asserções do fim cobrem isso.
  //
  // O login de B tem que ser feito PELO FORMULÁRIO, sem page.goto: um goto é
  // carregamento completo, destrói o QueryClient e o vazamento não acontece
  // (foi assim que a primeira versão deste teste passou sem a correção).
  await page.setViewportSize({ width: 1440, height: 900 });
  await registerAndLogin(page);
  await criarConta(page, { amount: 777, description: "Conta secreta do A", dueInDays: -1 });
  await page.reload();
  await dismissTourIfPresent(page);
  await expect(page.locator(BADGE)).toHaveText("1", { timeout: 15_000 });

  // B precisa existir antes, mas registrar por fetch não navega — a SPA de A
  // segue viva, que é a condição do vazamento.
  const emailB = `e2e-b-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.com`;
  const senha = "SenhaSegura123!";
  const criado = await page.evaluate(
    async ([email, password]) => {
      const res = await fetch("http://localhost:8000/api/v1/auth/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      return res.status;
    },
    [emailB, senha] as const
  );
  expect(criado).toBe(201);

  await page.getByRole("button", { name: "Menu da conta" }).click();
  await page.getByRole("button", { name: /Sair/ }).click();
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });

  // O /login chegou por navegação client-side e ainda está hidratando: um
  // fill antes disso é descartado quando o React assume o input controlado
  // (o campo fica vazio e o submit não sai). Repete até o valor grudar.
  // Marcador de sessão de JS: o cenário só faz sentido enquanto a SPA de A
  // continua viva — se a página recarregar, o QueryClient morre junto e o
  // teste passaria à toa. Melhor falhar dizendo isso do que passar em falso.
  await page.evaluate(() => { (window as Window & { __spaViva?: boolean }).__spaViva = true; });
  const spaViva = () => page.evaluate(() => !!(window as Window & { __spaViva?: boolean }).__spaViva);

  // O componente de /login pode remontar logo depois do logout (a proteção
  // de rota reavalia e empurra /login de novo), e a remontagem zera o
  // estado do formulário — inclusive um valor recém-digitado. Remontar é
  // inofensivo para o cenário (o JS é o mesmo), então basta repreencher;
  // recarregar não seria, e é o que o marcador acima detecta.
  await expect(async () => {
    expect(await spaViva(), "a página recarregou: o cenário exige a mesma sessão de JS").toBe(true);
    await page.getByLabel("Email").fill(emailB);
    await page.getByLabel("Senha", { exact: true }).fill(senha);
    await expect(page.getByLabel("Email")).toHaveValue(emailB, { timeout: 1_000 });
    await expect(page.getByLabel("Senha", { exact: true })).toHaveValue(senha, { timeout: 1_000 });
  }).toPass({ timeout: 30_000 });

  expect(await spaViva(), "a página recarregou antes do login").toBe(true);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/overview/, { timeout: 30_000 });
  await dismissTourIfPresent(page);

  await expect(page.getByText("Conta secreta do A")).toHaveCount(0);
  await page.locator(BOTAO).click();
  await expect(painel(page).getByText("Tudo em dia — nenhuma pendência.")).toBeVisible({ timeout: 15_000 });
});
