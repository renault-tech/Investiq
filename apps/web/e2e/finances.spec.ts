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

  // Anchored at the start: the description itself contains "excluir", so an
  // unanchored match also catches the "Editar Transação para excluir" button.
  await page
    .locator("tr", { hasText: "Transação para excluir" })
    .getByRole("button", { name: /^excluir/i })
    .click();

  const dialog = page.getByRole("dialog", { name: "Excluir transação" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Excluir" }).click();

  // Scoped to the table: the confirmation dialog's own copy ("Excluir
  // “Transação para excluir”?") also matches an unscoped getByText while it's
  // still closing, so an unscoped assertion here is a race between the
  // dialog unmounting and the table refetching — flaky under CI load. What
  // actually matters is the row leaving the table, not the dialog's text.
  await expect(dialog).not.toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("table").getByText("Transação para excluir")).not.toBeVisible({
    timeout: 10_000,
  });
});

test("cancelar no modal de exclusão não apaga nada", async ({ page }) => {
  await registerAndLogin(page);
  await page.goto("/finances");

  await addExpense(page, "50", "Não deveria sumir");
  await expect(page.getByText("Não deveria sumir")).toBeVisible({ timeout: 10_000 });

  await page
    .locator("tr", { hasText: "Não deveria sumir" })
    .getByRole("button", { name: /^excluir/i })
    .click();

  const dialog = page.getByRole("dialog", { name: "Excluir transação" });
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText("Não deveria sumir")).toBeVisible();
});

test("apagar a primeira parcela não oferece 'esta e as futuras' — seria idêntico a 'toda a série'", async ({ page }) => {
  await registerAndLogin(page);
  await page.goto("/finances");

  await page.getByRole("button", { name: "Nova transação" }).click();
  const newDialog = page.getByRole("dialog", { name: "Nova transação" });
  await newDialog.getByRole("button", { name: "Despesa" }).click();
  await newDialog.getByLabel("Valor (R$)").fill("300");
  await newDialog.getByLabel("Descrição").fill("Compra parcelada E2E");
  await newDialog.getByLabel("Parcelas").fill("3");
  await newDialog.getByRole("button", { name: "Salvar" }).click();
  await expect(newDialog).not.toBeVisible({ timeout: 10_000 });

  // As parcelas 2 e 3 caem em meses futuros — só a primeira aparece na
  // tabela do mês corrente.
  const row = page.locator("tr", { hasText: "Compra parcelada E2E" });
  await expect(row).toBeVisible({ timeout: 10_000 });

  await row.getByRole("button", { name: /^excluir/i }).click();

  // O antigo fluxo encadeava dois window.confirm — "OK apaga tudo, Cancelar
  // deixa escolher". Agora cada desfecho é um botão nomeado, lado a lado.
  const dialog = page.getByRole("dialog", { name: "Excluir parcela" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: /Só esta parcela/ })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /Toda a série/ })).toBeVisible();
  // Na parcela 1/3 não há parcela anterior: "esta e as futuras" seria
  // idêntico a "toda a série", então não deve aparecer como opção à parte.
  await expect(dialog.getByRole("button", { name: /Esta e as futuras/ })).not.toBeVisible();

  await dialog.getByRole("button", { name: /Só esta parcela/ }).click();
  await expect(dialog).not.toBeVisible({ timeout: 10_000 });
  await expect(row).not.toBeVisible({ timeout: 10_000 });
});

test("apagar uma parcela do meio da série oferece os três desfechos", async ({ page }) => {
  await registerAndLogin(page);
  await page.goto("/finances");

  await page.getByRole("button", { name: "Nova transação" }).click();
  const newDialog = page.getByRole("dialog", { name: "Nova transação" });
  await newDialog.getByRole("button", { name: "Despesa" }).click();
  await newDialog.getByLabel("Valor (R$)").fill("400");
  await newDialog.getByLabel("Descrição").fill("Parcela do meio E2E");
  await newDialog.getByLabel("Parcelas").fill("4");
  await newDialog.getByRole("button", { name: "Salvar" }).click();
  await expect(newDialog).not.toBeVisible({ timeout: 10_000 });

  // Avança para o mês seguinte, onde cai a parcela 2/4 — tem parcela
  // anterior (1) e parcelas futuras (3, 4), então as três opções fazem sentido.
  await page.getByRole("button", { name: "Próximo mês" }).click();
  const row = page.locator("tr", { hasText: "Parcela do meio E2E" });
  await expect(row).toBeVisible({ timeout: 10_000 });

  await row.getByRole("button", { name: /^excluir/i }).click();
  const dialog = page.getByRole("dialog", { name: "Excluir parcela" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: /Só esta parcela/ })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /Esta e as futuras \(3 parcelas\)/ })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /Toda a série \(4 parcelas\)/ })).toBeVisible();

  await dialog.getByRole("button", { name: /Esta e as futuras/ }).click();
  await expect(dialog).not.toBeVisible({ timeout: 10_000 });
  await expect(row).not.toBeVisible({ timeout: 10_000 });

  // A parcela 1, no mês anterior, não deve ter sido afetada por "esta e as futuras".
  await page.getByRole("button", { name: "Mês anterior" }).click();
  await expect(page.locator("tr", { hasText: "Parcela do meio E2E" })).toBeVisible({ timeout: 10_000 });
});
