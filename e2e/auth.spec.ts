// e2e/auth.spec.ts
// B0-09 browser checks that need no real Supabase account: protected-route redirects, the auth
// pages, and server-side validation. Signing in for real is covered by the manual check in
// docs/SECURITY.md.
import { expect, test } from "@playwright/test";

test("a signed-out visitor of a protected page is sent to sign in, keeping the path", async ({
  page,
}) => {
  await page.goto("/events?tab=budget");
  await expect(page).toHaveURL(/\/login\?next=%2Fevents%3Ftab%3Dbudget$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.locator('input[name="next"]')).toHaveValue("/events?tab=budget");
});

test("sign in shows accessible errors from server-side validation", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByLabel(/Email/)).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("link", { name: "Enter your email address." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Enter your password." })).toBeVisible();
});

test("sign up enforces the 8-character password rule on the server", async ({ page }) => {
  await page.goto("/sign-up");
  await page.getByLabel(/Name/).fill("Mika");
  await page.getByLabel(/Email/).fill("mika@example.com");
  await page.getByLabel(/Password/).fill("1234567");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("link", { name: "Use at least 8 characters." })).toBeVisible();
  await expect(page.getByLabel(/Name/)).toHaveValue("Mika");
  await expect(page.getByLabel(/Password/)).toHaveValue("");
});

test("an off-site next path is replaced with the app's default page", async ({ page }) => {
  await page.goto("/login?next=https%3A%2F%2Fevil.example");
  await expect(page.locator('input[name="next"]')).toHaveValue("/events");
});

test("the login page shows only known error messages", async ({ page }) => {
  // Scoped to <main>: Next.js adds its own role="alert" route announcer outside it.
  const main = page.getByRole("main");
  await page.goto("/login?error=confirm");
  await expect(main.getByRole("alert")).toContainText("That link is invalid or has expired.");

  await page.goto("/login?error=%3Cb%3Ehacked%3C%2Fb%3E");
  await expect(main.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(main.getByRole("alert")).toHaveCount(0);
  await expect(page.getByText("hacked")).toHaveCount(0);
});

test("a confirm link without a token goes back to sign in with an explanation", async ({
  page,
}) => {
  await page.goto("/auth/confirm");
  await expect(page).toHaveURL(/\/login\?error=confirm$/);
});