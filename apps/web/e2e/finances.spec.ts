import { test, expect } from "@playwright/test";
import { registerAndLogin } from "./helpers";

/** Fills and submits the "Nova transação" modal, scoped to the dialog —
 * the transactions table has its own "Buscar por descrição" search box
 * whose accessible name also contains "Descrição", so an unscoped
 * getByLabel("Descrição") is ambiguous once the table is on screen. */
async function addExpense(page: import("@playwright/test").Page, amount: string, description: string) {
  await page.getByRole("button", { name: "Nova transação" }).click();
  const dialog = page.getByRole("dialog", { name: "Nova transação" });
  await dialog.getByRole("button", { name: "Despesa" }).click();
  await dialog.getByLabel("Valor (R$)").fill(amount);
  await dialog.getByLabel("Descrição").fill(description);
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(dialog).not.toBeVisible({ timeout: 10_000 });
}

test("register an expense and see it reflected in the monthly summary and table", async ({ page }) => {
  await registerAndLogin(page);
  await page.goto("/finances");

  await addExpense(page, "123.45", "Compra E2E");

  await expect(page.getByText("Compra E2E")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("R$ 123,45").first()).toBeVisible({ timeout: 10_000 });
});

test("deleting a transaction removes it from the table", async ({ page }) => {
  await registerAndLogin(page);
  await page.goto("/finances");

  await addExpense(page, "50", "Transação para excluir");
  await expect(page.getByText("Transação para excluir")).toBeVisible({ timeout: 10_000 });

  page.on("dialog", (dialog) => dialog.accept());
  // Anchored at the start: the description itself contains "excluir", so an
  // unanchored match also catches the "Editar Transação para excluir" button.
  await page
    .locator("tr", { hasText: "Transação para excluir" })
    .getByRole("button", { name: /^excluir/i })
    .click();

  await expect(page.getByText("Transação para excluir")).not.toBeVisible({ timeout: 10_000 });
});
