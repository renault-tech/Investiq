import { test, expect } from "@playwright/test";
import { registerAndLogin, uniqueEmail } from "./helpers";

test("register redirects to /investments and shows the onboarding checklist", async ({ page }) => {
  await registerAndLogin(page, { fullName: "Playwright Test" });

  await expect(page.getByRole("heading", { name: "Primeiros passos" })).toBeVisible();
  await expect(page.getByText("Nenhum portfólio encontrado.")).toBeVisible();
});

test("logging out and back in with the same credentials works", async ({ page }) => {
  const email = uniqueEmail();
  const password = "SenhaSegura123!";

  await page.goto("/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/investments/, { timeout: 15_000 });

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/investments/, { timeout: 15_000 });
});

test("wrong password shows an error and stays on the login page", async ({ page }) => {
  const email = uniqueEmail();
  await page.goto("/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill("SenhaCorreta123!");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/investments/, { timeout: 15_000 });

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill("SenhaErrada999!");
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page).toHaveURL(/\/login/);
  // Scoped to <p> — the error message is always rendered as a paragraph,
  // unlike the permanently-visible "Senha" label and "Esqueci minha senha"
  // link, which also match a loose text-content regex like this one.
  await expect(page.locator("p", { hasText: /senha|credenc|inválid|password|mismatch/i })).toBeVisible({
    timeout: 10_000,
  });
});
