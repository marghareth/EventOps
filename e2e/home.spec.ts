// e2e/home.spec.ts
import { expect, test } from "@playwright/test";

test("home page shows the product name", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "EventOps" })).toBeVisible();
});