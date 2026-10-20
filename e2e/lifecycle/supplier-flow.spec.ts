// e2e/lifecycle/supplier-flow.spec.ts
// B4-03 to B4-05: suppliers in a real browser, signed in as the dev demo user (D-024), against a
// reset test database: add a supplier (Other needs to say what they provide), edit it, cancel and
// then confirm removing it, find each change in Activity without contact details, and as a Viewer
// read the list with no way to change it. Run with `npm run test:e2e:lifecycle` (docs/TESTING.md);
// CI runs it in the "e2e" job.
import { expect, test } from "@playwright/test";
import { resetDemoData } from "../../scripts/reset-demo";
import { addSecondOwner, setDemoRole } from "./db";

test.describe.configure({ mode: "serial" });

const EVENT = `Supplier Flow ${Date.now()}`;
let suppliersPath = "";

const database = () => process.env.E2E_DATABASE_URL ?? "";
test.beforeAll(async () => resetDemoData(database()));
test.afterAll(async () => resetDemoData(database()));

test("1. a new event has no suppliers; add one, with Other saying what they provide", async ({
  page,
}) => {
  await page.goto("/events/new");
  await page.getByLabel(/Event name/).fill(EVENT);
  await page.getByLabel(/^Date/).fill("2099-12-12");
  await page.getByLabel(/^Start time/).fill("16:00");
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}\?created=/);
  suppliersPath = `${new URL(page.url()).pathname}/suppliers`;

  await page.goto(suppliersPath);
  await expect(page.getByRole("heading", { name: "No suppliers yet" })).toBeVisible();
  await page.getByRole("link", { name: "Add the first supplier" }).click();

  await page.getByLabel(/^Name/).fill("Sparkle Lights");
  await page.getByLabel(/^Category/).selectOption("Other");
  await page.getByRole("button", { name: "Add supplier" }).click();
  // The server refuses Other without a description, keeping what was typed.
  await expect(
    page.getByRole("link", { name: "Say what the supplier provides, for example “Fireworks”." }),
  ).toBeVisible();
  await expect(page.getByLabel(/^Name/)).toHaveValue("Sparkle Lights");

  await page.getByLabel(/^What they provide/).fill("Fireworks");
  await page.getByLabel(/^Phone/).fill("0917 555 0104");
  await page.getByRole("button", { name: "Add supplier" }).click();
  await expect(page).toHaveURL(/\/suppliers\?added=SUP-0001$/);
  await expect(page.getByText("Sparkle Lights is on the supplier list as SUP-0001.")).toBeVisible();
  await expect(page.getByText("Other: Fireworks")).toBeVisible();
});

test("2. edit the supplier", async ({ page }) => {
  await page.goto(suppliersPath);
  await page.getByRole("link", { name: "Edit Sparkle Lights (SUP-0001)" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Edit Sparkle Lights" })).toBeVisible();
  await expect(page.getByLabel(/^What they provide/)).toHaveValue("Fireworks");

  await page.getByLabel(/^Name/).fill("Sparkle Lights PH");
  await page.getByLabel(/^Category/).selectOption("Sound and lights");
  await expect(page.getByLabel(/^What they provide/)).toHaveCount(0);
  await page.getByLabel(/^Phone/).fill("0917 555 0199");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL(/\/suppliers\?saved=SUP-0001$/);
  await expect(page.getByText("Sparkle Lights PH (SUP-0001) is up to date.")).toBeVisible();
  // Scoped to the supplier's card: the category filter lists the same words (B4-18).
  await expect(page.getByRole("listitem").filter({ hasText: "Sparkle Lights PH" })).toContainText(
    "Sound and lights",
  );
});

test("3. removing asks first; Cancel keeps the supplier, confirming removes it", async ({
  page,
}) => {
  await page.goto(suppliersPath);
  await page.getByRole("link", { name: "Edit Sparkle Lights PH (SUP-0001)" }).click();
  await page.getByRole("button", { name: "Remove supplier" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Remove this supplier?" });
  await expect(dialog).toContainText("Sparkle Lights PH (SUP-0001) will be removed");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("button", { name: "Remove supplier" }).click();
  await dialog.getByRole("button", { name: "Remove supplier" }).click();
  await expect(page).toHaveURL(/\/suppliers\?removed=SUP-0001$/);
  await expect(page.getByText("SUP-0001 is no longer on the supplier list.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "No suppliers yet" })).toBeVisible();
});

test("4. Activity records each change, never contact details", async ({ page }) => {
  await page.goto(suppliersPath.replace(/\/suppliers$/, "/activity"));
  const feed = page.getByRole("main");
  await expect(feed).toContainText(
    "Added the supplier Sparkle Lights (SUP-0001): Other: Fireworks",
  );
  await expect(feed).toContainText("Edited the supplier SUP-0001");
  await expect(feed).toContainText("Category: Other: Fireworks → Sound and lights");
  await expect(feed).toContainText("Phone changed");
  await expect(feed).toContainText("Removed the supplier Sparkle Lights PH (SUP-0001)");
  await expect(feed).not.toContainText("0917 555");
});

test("5. a Viewer reads suppliers and their contacts but can't change them", async ({ page }) => {
  // A new supplier gets the next number: removed numbers are never reused.
  await page.goto(`${suppliersPath}/new`);
  await page.getByLabel(/^Name/).fill("Garden Kitchen");
  await page.getByLabel(/^Category/).selectOption("Catering");
  await page.getByLabel(/^Email/).fill("liza@gardenkitchen.ph");
  await page.getByRole("button", { name: "Add supplier" }).click();
  await expect(page).toHaveURL(/\/suppliers\?added=SUP-0002$/);
  await page.getByRole("link", { name: "Edit Garden Kitchen (SUP-0002)" }).click();
  await expect(page).toHaveURL(/\/suppliers\/[0-9a-f-]{36}\/edit$/);
  const editPath = new URL(page.url()).pathname;

  const eventId = suppliersPath.split("/")[2];
  await addSecondOwner(eventId);
  await setDemoRole(eventId, "VIEWER");

  await page.goto(suppliersPath);
  await expect(page.getByRole("heading", { level: 3, name: "Garden Kitchen" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Add supplier" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /^Edit / })).toHaveCount(0);
  // The list shows only the contact person (D-073); the email is on the supplier's page, which a
  // Viewer can read. (This step expected it on the list; found in B10 once step 2 ran again.)
  await page.goto(editPath.replace(/\/edit$/, ""));
  await expect(page.getByRole("link", { name: "liza@gardenkitchen.ph" })).toBeVisible();

  await page.goto(editPath);
  await expect(page.getByRole("heading", { name: "You don't have access to this" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove supplier" })).toHaveCount(0);
});