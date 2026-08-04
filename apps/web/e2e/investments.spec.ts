import { test, expect } from "@playwright/test";
import { registerAndLogin, createPortfolio, addPosition } from "./helpers";

test("create a portfolio, add a position with an initial buy, see it in the positions table", async ({ page }) => {
  await registerAndLogin(page);
  await createPortfolio(page, "Carteira E2E");
  await expect(page.getByText("Carteira E2E")).toBeVisible({ timeout: 10_000 });

  await addPosition(page, { ticker: "VALE3", quantity: "10", price: "60" });

  await expect(page.getByText("VALE3")).toBeVisible({ timeout: 10_000 });
  // avg_cost is derived purely from the transaction (no live market price
  // needed) — the R$60 unit price paid should show up as-is.
  await expect(page.getByText("R$ 60,00")).toBeVisible({ timeout: 10_000 });
});

test("onboarding checklist step flips to done after creating a portfolio", async ({ page }) => {
  await registerAndLogin(page);
  await expect(page.getByRole("heading", { name: "Primeiros passos" })).toBeVisible();

  await createPortfolio(page, "Carteira Onboarding");
  await expect(page.getByText("Carteira Onboarding")).toBeVisible({ timeout: 10_000 });

  // "Criar uma carteira" step should now render struck-through (done) rather than as a link
  await page.reload();
  const doneStep = page.locator("li", { hasText: "Criar uma carteira" });
  await expect(doneStep.locator("span.line-through")).toBeVisible({ timeout: 10_000 });
});
