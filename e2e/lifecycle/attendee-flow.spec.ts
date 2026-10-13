// e2e/lifecycle/attendee-flow.spec.ts
// B2-24: the whole attendee flow in a real browser, signed in as the dev demo user (D-024), against
// a reset test database: create and edit an attendee, search, filter and sort, import a CSV, export
// and read the file. A second event with its own guest proves nothing crosses between events. Run
// with `npm run test:e2e:lifecycle` (docs/TESTING.md); CI runs it in the "e2e" job.
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { parseCsv } from "../../src/modules/events/attendees/csv";
import { resetDemoData } from "../../scripts/reset-demo";

test.describe.configure({ mode: "serial" });

const STAMP = Date.now();
const EVENT = `Attendee Flow ${STAMP}`;
const OTHER_EVENT = `Other Event ${STAMP}`;
const OTHER_GUEST = "Only In The Other Event";
let eventPath = "";

const database = () => process.env.E2E_DATABASE_URL ?? "";
// Start and end with no demo events, so the lifecycle spec's "no events yet" holds in any order.
test.beforeAll(async () => resetDemoData(database()));
test.afterAll(async () => resetDemoData(database()));

async function createEvent(page: Page, name: string): Promise<string> {
  await page.goto("/events/new");
  await page.getByLabel(/Event name/).fill(name);
  await page.getByLabel(/^Date/).fill("2099-12-12");
  await page.getByLabel(/^Start time/).fill("16:00");
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}\?created=/);
  return new URL(page.url()).pathname;
}

async function addAttendee(page: Page, path: string, name: string) {
  await page.goto(`${path}/attendees/new`);
  await page.getByLabel(/^Name/).fill(name);
  await page.getByRole("button", { name: "Add attendee" }).click();
  await expect(page.getByText("Attendee added")).toBeVisible();
}

test("1. open a fresh event, and a second event with its own guest", async ({ page }) => {
  const otherPath = await createEvent(page, OTHER_EVENT);
  await addAttendee(page, otherPath, OTHER_GUEST);
  eventPath = await createEvent(page, EVENT);
  await page.goto("/events");
  await page.getByRole("link", { name: EVENT }).click();
  await expect(page.getByRole("region", { name: "Current event" })).toContainText(EVENT);
  await page.getByRole("link", { name: "Attendees" }).first().click();
  await expect(page.getByRole("heading", { name: "No attendees yet" })).toBeVisible();
});

test("2. create an attendee with a plus-one, dietary needs and an RSVP", async ({ page }) => {
  await page.goto(`${eventPath}/attendees/new`);
  await page.getByLabel(/^Name/).fill("Maria Santos");
  await page.getByLabel(/^Email/).fill("maria@example.com");
  await page.getByLabel(/^Plus-ones/).fill("1");
  await page.getByLabel(/^Dietary needs/).fill("Vegetarian; no nuts");
  await page.getByLabel(/^RSVP/).selectOption("CONFIRMED");
  await page.getByLabel(/^Category/).fill("Family");
  await page.getByRole("button", { name: "Add attendee" }).click();

  await expect(page.getByText("Attendee added")).toBeVisible();
  const summary = page.getByRole("region", { name: "Headcount from the guest list" });
  await expect(summary).toContainText("Expected headcount2");
  await expect(page.getByRole("row", { name: /Maria Santos/ })).toContainText(
    "Vegetarian; no nuts",
  );
});

test("3. edit the attendee from the details page", async ({ page }) => {
  await page.goto(`${eventPath}/attendees`);
  await page.getByRole("link", { name: "Maria Santos" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Maria Santos" })).toBeVisible();
  await page.getByRole("link", { name: "Edit attendee" }).click();
  await page.getByLabel(/^Name/).fill("Maria S. Lim");
  await page.getByLabel(/^Plus-ones/).fill("2");
  await page.getByLabel(/^Notes/).fill("Seat near the stage");
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByText("Changes saved")).toBeVisible();
  await expect(page.getByRole("region", { name: "Headcount from the guest list" })).toContainText(
    "Expected headcount3",
  );
});

test("4. import a CSV: match columns, preview, confirm, and see the new attendees", async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), "eventops-e2e-"));
  const file = join(dir, "guests.csv");
  writeFileSync(
    file,
    [
      "Guest Name,E-mail,RSVP,Plus ones,Group",
      "Ben Lim,ben@example.com,Yes,0,Friends",
      "Carla Santos,,Maybe,2,Family",
      "José Peña,jose@example.com,No,,Friends",
      "Bad Row,not-an-email,perhaps,eleven,Friends",
    ].join("\r\n"),
  );
  await page.goto(`${eventPath}/attendees`);
  await page.getByRole("link", { name: "Import CSV" }).click();
  await page.getByLabel("CSV file").setInputFiles(file);
  await page.getByRole("button", { name: "Upload and continue" }).click();

  await expect(page.getByRole("heading", { name: "2. Match your columns" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Guest Name" })).toHaveValue("name");
  await expect(page.getByRole("combobox", { name: "Group" })).toHaveValue("category");
  await page.getByRole("button", { name: "Preview the import" }).click();

  await expect(page.getByRole("heading", { name: "3. Check before importing" })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Rows that need correction", exact: true }),
  ).toContainText("Bad Row");
  await page.getByRole("button", { name: "Import 3 attendees" }).click();

  await expect(page.getByRole("heading", { name: "Import complete" })).toBeVisible();
  await expect(page.getByText("3 attendees were added")).toBeVisible();
  await page.getByRole("link", { name: "Go to the guest list" }).click();
  await expect(page.getByText("4 attendees")).toBeVisible();
  await expect(page.getByRole("rowheader")).toHaveText([
    "Ben Lim",
    "Carla Santos",
    "José Peña",
    "Maria S. Lim",
  ]);
  await expect(page.getByRole("rowheader", { name: OTHER_GUEST })).toHaveCount(0);
});

test("5. search, filter and sort the guest list", async ({ page }) => {
  await page.goto(`${eventPath}/attendees`);
  await page.getByRole("searchbox", { name: "Search attendees" }).fill("pena");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("1 of 4 attendees match")).toBeVisible();
  await expect(page.getByRole("rowheader")).toHaveText(["José Peña"]);

  await page.getByRole("searchbox", { name: "Search attendees" }).fill(OTHER_GUEST);
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByRole("heading", { name: "No attendees match" })).toBeVisible();

  await page.getByRole("link", { name: "Clear search and filters" }).click();
  await expect(page).toHaveURL(new RegExp(`${eventPath}/attendees$`));
  await page.getByLabel("Category").selectOption("Family");
  await page.getByLabel("Sort by").selectOption("plusones");
  await page.getByLabel("Order").selectOption("desc");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/sort=plusones&dir=desc/);
  await expect(page.getByRole("rowheader")).toHaveText(["Carla Santos", "Maria S. Lim"]);

  await page.getByRole("link", { name: /^Confirmed/ }).click();
  await expect(page).toHaveURL(/rsvp=confirmed/);
  await expect(page.getByRole("rowheader")).toHaveText(["Maria S. Lim"]);
  await expect(page.getByRole("columnheader", { name: "Plus-ones" })).toHaveAttribute(
    "aria-sort",
    "descending",
  );
});

test("6. export the guest list and check the file", async ({ page }) => {
  await page.goto(`${eventPath}/attendees`);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Export CSV" }).click(),
  ]);
  await expect(
    page.getByText(/Downloaded EVT-\d{4}-\d{4,}-attendees-.*\.csv \(4 attendees\)\./),
  ).toBeVisible();
  expect(download.suggestedFilename()).toMatch(
    /^EVT-\d{4}-\d{4,}-attendees-\d{4}-\d{2}-\d{2}\.csv$/,
  );

  const text = readFileSync(await download.path(), "utf8");
  const parsed = parseCsv(text);
  if (!parsed.ok) throw new Error(parsed.error);
  expect(parsed.table.headers).toEqual([
    "ID",
    "Name",
    "RSVP",
    "Plus-ones",
    "Category",
    "Dietary needs",
    "Email",
    "Phone",
    "Notes",
  ]);
  expect(parsed.table.rows.map((r) => r.cells.slice(0, 5))).toEqual([
    ["ATT-0001", "Maria S. Lim", "Confirmed", "2", "Family"],
    ["ATT-0002", "Ben Lim", "Confirmed", "0", "Friends"],
    ["ATT-0003", "Carla Santos", "Maybe", "2", "Family"],
    ["ATT-0004", "José Peña", "Declined", "0", "Friends"],
  ]);
  expect(parsed.table.rows[0].cells[5]).toBe("Vegetarian; no nuts");
  expect(parsed.table.rows[0].cells[8]).toBe("Seat near the stage");
  expect(text).not.toContain(OTHER_GUEST);
});

test("7. Activity records every step, and no step needed a permission it didn't have", async ({
  page,
}) => {
  await page.goto(`${eventPath}/activity`);
  const feed = page.locator("main ol");
  await expect(feed).toContainText("Exported the guest list as CSV (4 attendees)");
  await expect(feed).toContainText("Imported 3 attendees from a CSV file (ATT-0002 to ATT-0004)");
  await expect(feed).toContainText("Edited the attendee ATT-0001");
  await expect(feed).toContainText("Added the attendee Maria Santos (ATT-0001)");
  await expect(feed).not.toContainText(OTHER_GUEST);
  await expect(page.getByText(/You don't have access/)).toHaveCount(0);
});