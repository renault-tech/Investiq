import { Page, expect } from "@playwright/test";

export function uniqueEmail(prefix = "e2e"): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.com`;
}

/** Registers a fresh user through the real UI and waits for the post-login redirect. */
export async function registerAndLogin(page: Page, opts?: { fullName?: string }): Promise<{ email: string }> {
  const email = uniqueEmail();
  const password = "SenhaSegura123!";

  await page.goto("/register");
  if (opts?.fullName) {
    await page.getByLabel("Nome (opcional)").fill(opts.fullName);
  }
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Criar conta" }).click();

  await expect(page).toHaveURL(/\/overview/, { timeout: 15_000 });
  // Um usuário recém-criado ainda não viu nenhum tour — o balão abre
  // sozinho na primeira tela e seu backdrop (fixed inset-0) cobre a
  // página inteira, bloqueando cliques em qualquer outro elemento até
  // ser fechado. "Não mostrar mais" desativa o tour pro resto da sessão
  // (persistido em localStorage), então os testes não precisam lidar com
  // ele de novo a cada navegação.
  await dismissTourIfPresent(page);
  return { email };
}

/** Fecha o balão de tour guiado se ele estiver aberto na tela atual,
 * desativando-o pro resto da sessão. Sem alvo pra clicar nesse cenário —
 * um balão que nunca abriu não é erro, só não há nada a fazer. */
export async function dismissTourIfPresent(page: Page): Promise<void> {
  const dismissAllBtn = page.getByRole("button", { name: "Não mostrar mais" });
  if (await dismissAllBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await dismissAllBtn.click();
  }
}

/**
 * Creates a portfolio through the modal. Scoped to the dialog throughout —
 * the empty-state CTA on /investments ("Nenhuma carteira encontrada.") uses
 * the exact same label as the modal's submit button ("Criar carteira"),
 * so an unscoped locator is ambiguous while the empty state is still on
 * screen (i.e. right up until the mutation resolves).
 */
export async function createPortfolio(page: Page, name: string): Promise<void> {
  if (!page.url().includes("/investments")) {
    await page.goto("/investments");
  }
  await page.getByRole("button", { name: "+ Nova carteira" }).click();
  const dialog = page.getByRole("dialog", { name: "Nova carteira" });
  await dialog.getByLabel("Nome *").fill(name);
  await dialog.getByRole("button", { name: "Criar carteira" }).click();
  await expect(dialog).not.toBeVisible({ timeout: 10_000 });
}

export async function addPosition(
  page: Page,
  opts: { ticker: string; quantity?: string; price?: string }
): Promise<void> {
  await page.getByRole("button", { name: "+ Ativo" }).click();
  const dialog = page.getByRole("dialog", { name: "Adicionar Ativo" });
  await dialog.getByLabel("Ticker *").fill(opts.ticker);
  if (opts.quantity) await dialog.getByLabel("Quantidade").fill(opts.quantity);
  if (opts.price) await dialog.getByLabel("Preço Atual").fill(opts.price);
  await dialog.getByRole("button", { name: "Adicionar" }).click();
  await expect(dialog).not.toBeVisible({ timeout: 10_000 });
}
