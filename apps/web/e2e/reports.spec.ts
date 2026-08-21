import { test, expect } from "@playwright/test";
import { addPosition, createPortfolio, dismissTourIfPresent, registerAndLogin } from "./helpers";

test("exportar relatório mostra uma prévia e baixa o arquivo com o escopo no nome", async ({ page }) => {
  await registerAndLogin(page);
  await page.goto("/reports");
  await dismissTourIfPresent(page);

  await page.getByRole("button", { name: "Exportar relatório" }).click();
  const dialog = page.getByRole("dialog", { name: "Exportar relatório" });
  await expect(dialog).toBeVisible();

  // A prévia diz o que vai sair antes de gerar — o ponto do modal.
  await expect(dialog.getByText("Prévia do documento")).toBeVisible();
  await expect(dialog.getByText(/relatorio-completo-\d{4}-\d{2}\.pdf/)).toBeVisible();

  const download = await Promise.all([
    page.waitForEvent("download", { timeout: 60_000 }),
    dialog.getByRole("button", { name: "Gerar relatório" }).click(),
  ]).then(([d]) => d);

  expect(download.suggestedFilename()).toMatch(/^relatorio-completo-\d{4}-\d{2}\.pdf$/);
});

test("desmarcar investimentos muda a prévia e o nome do arquivo", async ({ page }) => {
  await registerAndLogin(page);
  await page.goto("/reports");
  await dismissTourIfPresent(page);

  await page.getByRole("button", { name: "Exportar relatório" }).click();
  const dialog = page.getByRole("dialog", { name: "Exportar relatório" });

  await dialog.getByRole("checkbox", { name: /Investimentos/ }).uncheck();

  // A seção some da prévia e o nome do arquivo passa a dizer "financas":
  // uma carteira pode ser de outra pessoa e não deve constar do documento.
  await expect(dialog.getByText(/relatorio-financas-\d{4}-\d{2}\.pdf/)).toBeVisible();
  await expect(dialog.getByText(/^Investimentos —/)).not.toBeVisible();
});

test("sem nenhuma seção marcada, gerar fica bloqueado", async ({ page }) => {
  await registerAndLogin(page);
  await page.goto("/reports");
  await dismissTourIfPresent(page);

  await page.getByRole("button", { name: "Exportar relatório" }).click();
  const dialog = page.getByRole("dialog", { name: "Exportar relatório" });

  await dialog.getByRole("checkbox", { name: /Finanças pessoais/ }).uncheck();
  await dialog.getByRole("checkbox", { name: /Investimentos/ }).uncheck();

  await expect(dialog.getByText("Escolha ao menos uma seção para gerar o relatório.")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Gerar relatório" })).toBeDisabled();
});

test("exportar a partir de Finanças já vem sem investimentos marcados", async ({ page }) => {
  await registerAndLogin(page);
  await page.goto("/finances");
  await dismissTourIfPresent(page);

  await page.getByRole("button", { name: "Exportar relatório" }).click();
  const dialog = page.getByRole("dialog", { name: "Exportar relatório" });

  await expect(dialog.getByRole("checkbox", { name: /Finanças pessoais/ })).toBeChecked();
  await expect(dialog.getByRole("checkbox", { name: /Investimentos/ })).not.toBeChecked();
});

test("a tabela de posições mostra quantidade no padrão brasileiro", async ({ page }) => {
  await registerAndLogin(page);
  await createPortfolio(page, "Padrão BR");
  // 15,6 cotas: era exibido "15.6000" e lido como quinze mil e seiscentos.
  await addPosition(page, { ticker: "TESTE3", quantity: "15,6", price: "10" });

  const row = page.locator("table tbody tr", { hasText: "TESTE3" });
  await expect(row).toBeVisible({ timeout: 15_000 });
  await expect(row).toContainText("15,6");
  await expect(row).not.toContainText("15.6");
});
