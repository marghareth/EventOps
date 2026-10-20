// e2e/lifecycle/import-flow.spec.ts
// B9: supplier import from an Excel file in a real browser against PostgreSQL, with the AI off (the
// deployed setup, D-112). From the Suppliers page's "Import suppliers" link the wizard starts with
// Suppliers chosen; the workbook's second sheet is picked; the columns are matched by rules and
// labelled so; the preview shows a row needing correction and never imports money; the import adds
// the suppliers with readable IDs and one Activity entry. A file that looks like the other list
// offers to switch. Works at phone width with no sideways scroll. A Viewer gets no import.
// Run with `npm run test:e2e:lifecycle` (docs/TESTING.md).
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { resetDemoData } from "../../scripts/reset-demo";
import { xlsx } from "../../src/modules/events/import/infrastructure/parsers/xlsx-test-file";
import { addSecondOwner, setDemoRole } from "./db";

test.describe.configure({ mode: "serial" });

const EVENT = `Reyes–Cruz Wedding (import) ${Date.now()}`;
let eventPath = "";
let eventId = "";
const dir = mkdtempSync(join(tmpdir(), "eventops-e2e-"));

const database = () => process.env.E2E_DATABASE_URL ?? "";
test.beforeAll(async () => resetDemoData(database()));
test.afterAll(async () => resetDemoData(database()));

const main = (page: Page) => page.locator("#main");

async function noSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test("1. import suppliers from the second sheet of an Excel file", async ({ page }) => {
  await page.goto("/login?next=%2Fevents");
  await page.getByLabel(/Email/).fill("coordinator@example.com");
  await page.getByLabel(/Password/).fill("a-long-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/events$/);

  await page.goto("/events/new");
  await page.getByLabel(/Event name/).fill(EVENT);
  await page.getByLabel(/^Date/).fill("2099-12-12");
  await page.getByLabel(/^Start time/).fill("16:00");
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}\?created=/);
  eventPath = new URL(page.url()).pathname;
  eventId = eventPath.split("/").pop()!;

  const file = join(dir, "vendors.xlsx");
  writeFileSync(
    file,
    xlsx({
      Notes: [["Planning notes"], ["Call the venue"]],
      Vendors: [
        ["Vendor", "Service", "Email", "Mobile", "Quote amount"],
        ["Garden Kitchen", "Caterer", "hello@garden.ph", "0917 123 4567", 120000],
        ["Boom Bros", "Fireworks", null, null, 45000],
        [null, "Florist", null, null, null],
      ],
    }),
  );

  await page.goto(`${eventPath}/suppliers`);
  await page.getByRole("link", { name: "Import suppliers" }).click();
  await expect(main(page).getByRole("radio", { name: /Suppliers/ })).toBeChecked();
  await page.getByLabel("CSV or Excel file").setInputFiles(file);
  await page.getByRole("button", { name: "Upload and continue" }).click();

  // The first sheet has a header but no supplier columns; choose the Vendors sheet.
  await expect(main(page).getByRole("heading", { name: "2. Match your columns" })).toBeVisible();
  await page.getByRole("button", { name: "Choose another sheet" }).click();
  await page.getByRole("combobox", { name: "Sheet to read" }).selectOption("Vendors");
  await page.getByLabel("CSV or Excel file").setInputFiles(file);
  await page.getByRole("button", { name: "Upload and continue" }).click();

  await expect(main(page).getByText(/from vendors\.xlsx \(sheet “Vendors”\)/)).toBeVisible();
  await expect(main(page).getByText("Matched by rules: AI wasn't available")).toBeVisible();
  await expect(main(page).getByRole("combobox", { name: "Vendor" })).toHaveValue("name");
  await expect(main(page).getByRole("combobox", { name: "Service" })).toHaveValue("category");
  await expect(main(page).getByRole("combobox", { name: "Quote amount" })).toHaveValue("");
  await page.getByRole("button", { name: "Preview the import" }).click();

  await expect(
    main(page).getByRole("heading", { name: "3. Check before importing" }),
  ).toBeVisible();
  await expect(
    main(page).getByRole("region", { name: "Rows that need correction", exact: true }),
  ).toContainText("Name: Enter the supplier's name.");
  await expect(
    main(page).getByRole("region", { name: "Rows that will be imported", exact: true }),
  ).toContainText("Other: Fireworks");
  await page.getByRole("button", { name: "Import 2 suppliers" }).click();

  await expect(main(page).getByRole("heading", { name: "Import complete" })).toBeVisible();
  await expect(main(page).getByText("2 suppliers were added")).toBeVisible();
  await page.getByRole("link", { name: "Go to the supplier list" }).click();
  await expect(main(page)).toContainText("Garden Kitchen");
  await expect(main(page)).toContainText("Boom Bros");

  await page.goto(`${eventPath}/activity`);
  await expect(main(page)).toContainText(
    "Imported 2 suppliers from an Excel file (SUP-0001 to SUP-0002)",
  );
});

test("2. a file that looks like the other list offers to switch, at phone width", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  const file = join(dir, "suppliers.csv");
  writeFileSync(file, "Vendor,Service\r\nBloom Co.,Florist\r\n");
  await page.goto(`${eventPath}/import`);
  await expect(main(page).getByRole("radio", { name: /Attendees/ })).toBeChecked();
  await page.getByLabel("CSV or Excel file").setInputFiles(file);
  await page.getByRole("button", { name: "Upload and continue" }).click();
  await expect(main(page).getByText("These columns look like a supplier list")).toBeVisible();
  await noSidewaysScroll(page);
  await page.getByRole("button", { name: "Import as suppliers instead" }).click();
  await expect(main(page).getByText(/Importing suppliers from suppliers\.csv/)).toBeVisible();
  await expect(main(page).getByRole("combobox", { name: "Vendor" })).toHaveValue("name");
  await noSidewaysScroll(page);
});

test("3. a Viewer gets no import", async ({ page }) => {
  await addSecondOwner(eventId);
  await setDemoRole(eventId, "VIEWER");
  await page.goto(`${eventPath}/suppliers`);
  await expect(main(page).getByRole("heading", { level: 1, name: "Suppliers" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Import suppliers" })).toHaveCount(0);
  await page.goto(`${eventPath}/import?type=suppliers`);
  await expect(page.getByRole("heading", { name: "You don't have access to this" })).toBeVisible();
});