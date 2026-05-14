import { test, expect } from "@playwright/test";

test("homepage renderiza o título", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Calculadora");
});
