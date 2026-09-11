/** Cartões — cartão visual (gradiente + fatura atual + barra de limite) e a
 * zona de upload. Cobre o que o build não protege: o card mostra "sem fatura
 * ainda" até haver alguma, a barra de limite só aparece com fatura de
 * verdade (não 0% enganoso pra quem nunca importou nada), e os selos de
 * confiança da zona de upload continuam visíveis. */
import { test, expect } from "@playwright/test";
import { registerAndLogin } from "./helpers";

async function criarCartao(
  page: import("@playwright/test").Page,
  { nome, limite }: { nome: string; limite?: string }
) {
  await page.getByRole("button", { name: "Novo cartão" }).click();
  const dialog = page.getByRole("dialog", { name: "Novo cartão" });
  await dialog.getByLabel("Apelido").fill(nome);
  if (limite) await dialog.getByLabel("Limite (R$)").fill(limite);
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(dialog).not.toBeVisible({ timeout: 10_000 });
}

test("cartão novo aparece com o visual do design, sem fatura ainda", async ({ page }) => {
  await registerAndLogin(page);
  await page.goto("/finances/cards");

  await criarCartao(page, { nome: "Cartão E2E", limite: "5000" });

  const card = page.getByRole("button", { name: /^Cartão Cartão E2E/ });
  await expect(card).toBeVisible();
  // Sem fatura importada ainda: nada de "0% do limite" — seria informação
  // fabricada. A barra de limite só existe depois de haver uma fatura real.
  await expect(card.getByText("sem fatura ainda")).toBeVisible();
  await expect(card.getByText(/% do limite/)).toHaveCount(0);
});

test("cartão sem limite não mostra a barra, mesmo depois de ter fatura", async ({ page }) => {
  await registerAndLogin(page);
  await page.goto("/finances/cards");
  await criarCartao(page, { nome: "Sem Limite E2E" });

  const card = page.getByRole("button", { name: /^Cartão Sem Limite E2E/ });
  await expect(card.getByText(/% do limite/)).toHaveCount(0);
});

test("zona de upload mostra os selos de confiança", async ({ page }) => {
  await registerAndLogin(page);
  await page.goto("/finances/cards");
  await criarCartao(page, { nome: "Upload E2E" });

  await expect(page.getByText("IA revisada por você antes de confirmar")).toBeVisible();
  await expect(page.getByText("Salvo na nuvem · histórico em qualquer lugar")).toBeVisible();
});
