/** Chrome do app (Sidebar + TopBar): trava o que o redesign do pacote
 * `handoff/` derrubaria em silêncio — âncoras do tour guiado referenciadas
 * por string, resolução do item ativo por prefixo mais longo, ícones do rail
 * recolhido e o AccountSwitcher que foi removido de propósito (#41). Nada
 * disso quebra o build nem o tsc; só aparece no browser. */
import { test, expect, Page } from "@playwright/test";
import { registerAndLogin, dismissTourIfPresent } from "./helpers";

/** Contraste WCAG medido no browser, resolvendo as CSS vars pela cascata
 * em vez de confiar nos hexes escritos no globals.css. */
async function contrast(page: Page, fgSel: string, bgSel: string): Promise<number> {
  return page.evaluate(([f, b]) => {
    const lum = (c: string) => {
      const [r, g, bl] = c.match(/[\d.]+/g)!.map(Number).slice(0, 3).map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
    };
    const fe = document.querySelector(f) as HTMLElement | null;
    const be = document.querySelector(b) as HTMLElement | null;
    if (!fe || !be) return -1;
    const l1 = lum(getComputedStyle(fe).color);
    const l2 = lum(getComputedStyle(be).backgroundColor);
    const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
    return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
  }, [fgSel, bgSel]);
}

test("TopBar preserva as âncoras do tour, os controles e não traz o AccountSwitcher de volta", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await registerAndLogin(page, { fullName: "Renault Castro" });

  // Referenciados por string em lib/tutorials.ts — o tour some sem eles.
  await expect(page.locator('[data-tour="topbar-privacy"]')).toBeVisible();
  await expect(page.locator('[data-tour="topbar-period"]')).toBeVisible();

  await expect(page.getByPlaceholder("Buscar ticker (ex: PETR4)")).toBeVisible();
  await expect(page.getByRole("button", { name: /Personalizar cards/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Menu da conta" })).toBeVisible();

  // Removido de propósito no commit 365543c (#41): dá pra marcar/desmarcar
  // conta clicando nelas, o dropdown era redundante.
  expect(await page.getByRole("button", { name: /Trocar conta|Contas/ }).count()).toBe(0);

  await page.getByRole("button", { name: "Menu da conta" }).click();
  await expect(page.getByRole("button", { name: /Sair/ })).toBeVisible();
});

test("item ativo da Sidebar resolve pelo prefixo mais longo", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await registerAndLogin(page);

  // /finances/cards casa em /finances E em /finances/cards no startsWith —
  // sem o desempate por comprimento, "Finanças" acende junto de "Cartões".
  await page.goto("/finances/cards");
  await dismissTourIfPresent(page);
  await expect(page.locator('aside a[aria-current="page"]')).toHaveText("Cartões");
  // Mesma ordem importa em PAGE_TITLES, que é lista e para no 1º prefixo.
  await expect(page.getByText("Cartões de crédito").first()).toBeVisible();

  await page.goto("/finances");
  await dismissTourIfPresent(page);
  await expect(page.locator('aside a[aria-current="page"]')).toHaveText("Finanças");
});

test("rail recolhido continua legível e o colapso sobrevive à navegação", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await registerAndLogin(page);

  await page.getByRole("button", { name: "Recolher menu" }).click();
  await expect
    .poll(() => page.locator("aside").evaluate((el) => el.getBoundingClientRect().width))
    .toBeLessThan(80);

  // Recolhido o rótulo some, então o ícone é a ÚNICA pista de cada item: o
  // componente do pacote pintava o ícone inativo de transparent, deixando
  // dez quadrados vazios idênticos.
  const painted = await page.locator("aside nav a svg").evaluateAll(
    (els) => els.filter((el) => {
      const c = getComputedStyle(el).color;
      return c !== "transparent" && !c.includes("rgba(0, 0, 0, 0)");
    }).length
  );
  expect(painted).toBe(await page.locator("aside nav a").count());

  // persist do zustand reidrata depois do 1º paint — daí o poll.
  await page.goto("/transactions");
  await dismissTourIfPresent(page);
  await expect
    .poll(() => page.locator("aside").evaluate((el) => el.getBoundingClientRect().width), { timeout: 10_000 })
    .toBeLessThan(80);
});

test("chrome passa em contraste AA nos dois temas", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await registerAndLogin(page, { fullName: "Renault Castro" });
  await expect(page.locator("aside .capitalize")).toBeVisible({ timeout: 15_000 });

  async function assertAA() {
    const theme = await page.evaluate(() => document.documentElement.className || "system");
    for (const [what, fg, bg] of [
      ["plano do usuário", "aside .capitalize", "aside"],
      ["breadcrumb", "header > div > div > span:first-child", "header"],
      ["item de menu inativo", "aside nav a:not([aria-current]) span:last-child", "aside"],
    ] as const) {
      const ratio = await contrast(page, fg, bg);
      expect(ratio, `${what} em tema ${theme}: ${ratio}:1`).toBeGreaterThan(4.5);
    }
    return theme;
  }

  const first = await assertAA();
  // O alternador do rodapé da Sidebar é o único do app.
  await page.getByTitle("Alternar tema").click();
  await expect.poll(() => page.evaluate(() => document.documentElement.className)).not.toBe(first);
  // Sem isto a medição pega o meio de alguma transição CSS e lê uma cor que
  // não é a de nenhum dos dois temas.
  await page.waitForTimeout(500);
  await assertAA();
});

test("faixa de cotações formata em pt-BR e sobrevive ao Decimal-como-string", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  // É assim que o Pydantic serializa Decimal — como STRING. Sem a coerção
  // de market-api.ts, formatDecimal receberia string e a faixa cairia.
  await page.route("**/market/quotes**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { ticker: "^BVSP", price: "141234.56000000", currency: "BRL", change_pct: "-0.84000000" },
        { ticker: "^GSPC", price: "6412.90000000", currency: "USD", change_pct: "0.31000000" },
        { ticker: "USDBRL=X", price: "5.42000000", currency: "BRL", change_pct: null },
      ]),
    })
  );

  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await registerAndLogin(page, { fullName: "Renault Castro" });
  await expect(page.getByText("Mercado", { exact: true })).toBeVisible({ timeout: 15_000 });

  const strip = await page.evaluate(() => {
    const label = [...document.querySelectorAll("span")].find((s) => s.textContent === "Mercado")!;
    return label.closest("div")!.parentElement!.innerText.replace(/\n/g, " ");
  });

  expect(errors).toEqual([]);
  expect(strip).toContain("141.234,56");
  expect(strip).toContain("-0,84%");
  expect(strip).toContain("+0,31%");
  expect(strip).toContain("USD/BRL 5,42"); // change_pct null: sem "NaN%", sem quebrar
  expect(strip).not.toContain("NaN");
});

test("a faixa de cotações nem monta no mobile", async ({ page }) => {
  // Esconder por CSS deixaria a query rodando de minuto em minuto em toda
  // tela, pra quem nunca vê a faixa.
  let quoteRequests = 0;
  await page.route("**/market/quotes**", (route) => {
    quoteRequests += 1;
    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await registerAndLogin(page);
  await page.waitForTimeout(2000);

  expect(await page.getByText("Mercado", { exact: true }).count()).toBe(0);
  expect(quoteRequests, "nenhuma busca de cotação no mobile").toBe(0);

  // e a tela não ganha rolagem horizontal
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
