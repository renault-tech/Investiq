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

  await expect(page).toHaveURL(/\/investments/, { timeout: 15_000 });
  return { email };
}

/**
 * Creates a portfolio through the modal. Scoped to the dialog throughout —
 * the empty-state CTA on /investments ("Nenhum portfólio encontrado.") uses
 * the exact same label as the modal's submit button ("Criar Portfólio"),
 * so an unscoped locator is ambiguous while the empty state is still on
 * screen (i.e. right up until the mutation resolves).
 */
export async function createPortfolio(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: "+ Portfólio" }).click();
  const dialog = page.getByRole("dialog", { name: "Novo Portfólio" });
  await dialog.getByLabel("Nome *").fill(name);
  await dialog.getByRole("button", { name: "Criar Portfólio" }).click();
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
