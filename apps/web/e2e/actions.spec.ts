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
