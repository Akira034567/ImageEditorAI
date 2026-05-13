import { expect, test } from "@playwright/test";

test("abre o editor e gera imagem mockada", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Editor IA" })).toBeVisible();
  await page.getByPlaceholder(/No circulo vermelho/i).fill("uma borboleta azul em fundo claro");
  await page.getByRole("button", { name: /Gerar nova imagem/i }).click();
  await expect(page.getByText("Resultado recebido")).toBeVisible();
});
