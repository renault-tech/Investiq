/** Busca global ⌘K/Ctrl+K — CommandPalette.tsx, renderizada uma vez em
 * PlatformShell.tsx. Cobre o que nenhum tsc/build protege: o atalho de
 * teclado, a navegação por setas, e os três tipos de resultado (telas,
 * ticker, ação rápida). */
import { test, expect } from "@playwright/test";
import { registerAndLogin, dismissTourIfPresent } from "./helpers";

async function abrirPaleta(page: import("@playwright/test").Page) {
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog")).toBeVisible();
  return page.getByRole("dialog");
}

test("Ctrl+K abre a paleta, busca uma tela e navega por Enter", async ({ page }) => {
  await registerAndLogin(page);
  const dialog = await abrirPaleta(page);

  await dialog.getByPlaceholder(/Buscar telas, ticker/).fill("Trans");
  await expect(dialog.getByText("Transações", { exact: true })).toBeVisible();
  // "Trader" não deve casar com "Trans" — confirma que o filtro é por
  // substring do rótulo, não uma correspondência solta.
  await expect(dialog.getByText("Trader", { exact: true })).not.toBeVisible();

  await page.keyboard.press("Enter");
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL(/\/transactions/);
});

test("Escape fecha a paleta sem navegar", async ({ page }) => {
  await registerAndLogin(page);
  const dialog = await abrirPaleta(page);
  await dialog.getByPlaceholder(/Buscar telas, ticker/).fill("Metas");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL(/\/overview/);
});

test("digitar um ticker oferece ir direto para o ativo", async ({ page }) => {
  await registerAndLogin(page);
  const dialog = await abrirPaleta(page);

  await dialog.getByPlaceholder(/Buscar telas, ticker/).fill("PETR4");
  const opcao = dialog.getByText("Ir para PETR4", { exact: true });
  await expect(opcao).toBeVisible();
  await opcao.click();

  await expect(page).toHaveURL(/\/investments\/PETR4/);
});

test("busca sem resultado mostra o estado vazio", async ({ page }) => {
  await registerAndLogin(page);
  const dialog = await abrirPaleta(page);
  // Nem tela, nem ticker (dígito no meio invalida o padrão de ticker) nem
  // ação rápida batem com isto.
  await dialog.getByPlaceholder(/Buscar telas, ticker/).fill("xyz não existe 123!!");
  await expect(dialog.getByText("Nada encontrado.")).toBeVisible();
});

test("setas navegam entre resultados e Enter aciona a ação rápida selecionada", async ({ page }) => {
  await registerAndLogin(page);
  const dialog = await abrirPaleta(page);

  // Sem filtro a ordem é Telas → Ativos → Ações rápidas, e "Configurações" é
  // sempre a última ação da lista — ArrowDown clampa em Math.min, então
  // descer bastante (bem mais que o número de telas) pousa nela
  // independente de quantos itens de navegação existirem. Um ArrowUp sobe
  // pra penúltima posição, que é sempre a ação de tema (a outra ação
  // rápida), sem depender da contagem de NAV_ITEMS.
  for (let i = 0; i < 30; i++) await page.keyboard.press("ArrowDown");
  await expect(dialog.getByText("Configurações", { exact: true })).toBeVisible();
  await page.keyboard.press("ArrowUp");

  const antes = await page.evaluate(() => document.documentElement.className);
  await page.keyboard.press("Enter");
  await expect(dialog).not.toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.className)).not.toBe(antes);
  // A ação não navega — continua na mesma tela.
  await expect(page).toHaveURL(/\/overview/);
});

test("reabrir a paleta começa com a busca vazia", async ({ page }) => {
  await registerAndLogin(page);
  const dialog = await abrirPaleta(page);
  await dialog.getByPlaceholder(/Buscar telas, ticker/).fill("Metas");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();

  const dialog2 = await abrirPaleta(page);
  await expect(dialog2.getByPlaceholder(/Buscar telas, ticker/)).toHaveValue("");
  await expect(dialog2.getByText("Visão geral", { exact: true })).toBeVisible();
});

test("a paleta funciona em qualquer tela, não só na inicial", async ({ page }) => {
  await registerAndLogin(page);
  await page.goto("/goals");
  await dismissTourIfPresent(page);

  const dialog = await abrirPaleta(page);
  await dialog.getByPlaceholder(/Buscar telas, ticker/).fill("Cartões");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/finances\/cards/);
});
