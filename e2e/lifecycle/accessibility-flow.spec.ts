// e2e/lifecycle/accessibility-flow.spec.ts
// B3-16: the accessibility workflow in a real browser, end to end, against a reset test database.
// Sign in → open the event → open a guest → add an accessibility need → save → set up an event
// resource → open readiness → see the status and the gap → add the missing resource → see readiness
// change (Not ready → Almost ready → Ready) → see Activity. Then the same screens as a Viewer.
//
// Realistic event: created through the app, with a twelve-guest list brought in through the CSV
// import, so every record is made by the signed-in user through the real server actions and their
// authorization. Sign-in uses the dev-only demo stand-in (D-024: there is no Supabase project in
// tests); event membership and role checks are the real ones. The only direct database step is
// e2e/lifecycle/db.ts changing the demo user's role, which stands in for member management screens
// that don't exist yet (D-034). Run with `npm run test:e2e:lifecycle` (docs/TESTING.md).
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { resetDemoData } from "../../scripts/reset-demo";
import { addSecondOwner, setDemoRole } from "./db";

test.describe.configure({ mode: "serial" });

const EVENT = `Reyes–Cruz Wedding ${Date.now()}`;
const NOTE = "Uses a wheelchair; seat near the aisle";
let eventPath = "";
let remediosPath = "";

const database = () => process.env.E2E_DATABASE_URL ?? "";
test.beforeAll(async () => resetDemoData(database()));
test.afterAll(async () => resetDemoData(database()));

const GUESTS = [
  "Guest Name,E-mail,RSVP,Plus ones,Group",
  "Maria Reyes,maria.reyes@example.com,Yes,0,Family",
  "Jose Cruz,jose.cruz@example.com,Yes,1,Family",
  "Remedios Cruz,,Yes,0,Family",
  "Ana Villanueva,ana.v@example.com,Yes,1,Friends",
  "Ben Lim,ben.lim@example.com,Maybe,0,Friends",
  "Carla Santos,,Yes,2,Family",
  "Paolo Reyes,paolo.reyes@example.com,Yes,0,Family",
  "Liza Tan,liza.tan@example.com,No,0,Colleagues",
  "Mark Dela Cruz,,Yes,1,Colleagues",
  "Nena Bautista,,Maybe,0,Family",
  "Rico Mendoza,rico.m@example.com,Yes,0,Friends",
  "Joy Aquino,joy.aquino@example.com,Yes,1,Colleagues",
].join("\r\n");

const readiness = (page: Page) => page.getByRole("region", { name: "Accessibility readiness" });
const gaps = (page: Page) => page.getByRole("region", { name: "What's missing" });

test("1. sign in, create a realistic event and import its guest list", async ({ page }) => {
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

  const dir = mkdtempSync(join(tmpdir(), "eventops-e2e-"));
  const file = join(dir, "reyes-cruz-guests.csv");
  writeFileSync(file, GUESTS);
  await page.goto(`${eventPath}/attendees`);
  await page.getByRole("link", { name: "Import CSV" }).click();
  await page.getByLabel("CSV file").setInputFiles(file);
  await page.getByRole("button", { name: "Upload and continue" }).click();
  await expect(page.getByRole("heading", { name: "2. Match your columns" })).toBeVisible();
  await page.getByRole("button", { name: "Preview the import" }).click();
  await page.getByRole("button", { name: "Import 12 attendees" }).click();
  await expect(page.getByText("12 attendees were added")).toBeVisible();
});

test("2. open the event from the list, then a guest from the guest list", async ({ page }) => {
  await page.goto("/events");
  await page.getByRole("link", { name: EVENT }).click();
  await expect(page).toHaveURL(new RegExp(`${eventPath}$`));
  // Nothing to check yet: no accessibility issue on the Overview's attention list (B8, D-107).
  await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Needs your attention" })).not.toContainText(
    "Accessibility is",
  );

  await page.getByRole("link", { name: "Attendees" }).first().click();
  await expect(page).toHaveURL(new RegExp(`${eventPath}/attendees$`));
  await page.getByRole("link", { name: "Remedios Cruz" }).click();
  await expect(page).toHaveURL(/\/attendees\/[0-9a-f-]{36}$/);
  remediosPath = new URL(page.url()).pathname;
  await expect(page.getByRole("region", { name: "Accessibility" })).toContainText(
    "No accessibility needs recorded for Remedios Cruz.",
  );
});

test("3. add an accessibility need and save it", async ({ page }) => {
  await page.goto(remediosPath);
  await page.getByRole("link", { name: "Add accessibility need" }).click();
  await page.getByRole("radio", { name: /^Accessible seating/ }).check();
  await page.getByRole("radio", { name: /^Required/ }).check();
  await page.getByLabel("Note").fill(NOTE);
  await page.getByRole("button", { name: "Add need" }).click();

  await expect(page).toHaveURL(new RegExp(`${remediosPath}\\?accessibility=added`));
  await expect(page.getByText("Accessibility need added")).toBeVisible();
  const section = page.getByRole("region", { name: "Accessibility", exact: true });
  await expect(section).toContainText("1 need recorded.");
  await expect(section).toContainText("Accessible seating");
  await expect(section).toContainText(NOTE);

  // A second guest needs captioning: the event will depend on a resource it doesn't have.
  await page.goto(`${eventPath}/attendees`);
  await page.getByRole("link", { name: "Paolo Reyes" }).click();
  await expect(page).toHaveURL(/\/attendees\/[0-9a-f-]{36}$/);
  await page.getByRole("link", { name: "Add accessibility need" }).click();
  await page.getByRole("radio", { name: "Captioning", exact: true }).check();
  await page.getByRole("button", { name: "Add need" }).click();
  await expect(page.getByText("Accessibility need added")).toBeVisible();
});

test("4. set up an event accessibility resource", async ({ page }) => {
  await page.goto(`${eventPath}/accessibility`);
  const provides = page.getByRole("region", { name: "What the event provides" });
  await provides.getByRole("link", { name: "Set up Accessible seats" }).click();
  await page.getByRole("radio", { name: "Available", exact: true }).check();
  await page.getByLabel(/^Number of accessible seats/).fill("2");
  await page.getByRole("button", { name: "Set up" }).click();
  await expect(page.getByText("Accessible seats is up to date.")).toBeVisible();
  await expect(
    provides.getByRole("listitem").filter({ hasText: "Accessible seats" }),
  ).toContainText("2 seats");
});

test("5. readiness: Not ready, with the missing resource named as the gap", async ({ page }) => {
  await page.goto(`${eventPath}/accessibility`);
  await expect(readiness(page)).toContainText("Status: Not ready");
  await expect(readiness(page)).toContainText("1 of 2 Required needs covered: 1 missing or short.");
  await expect(gaps(page)).toContainText("Captioning is not set up, but 1 guest needs it.");
  await expect(gaps(page)).toContainText("Makes the event Not ready.");
  await expect(gaps(page).getByRole("link", { name: /^Paolo Reyes \(ATT-\d{4}\)$/ })).toBeVisible();
  // The seats are enough, so they are not a gap.
  await expect(gaps(page)).not.toContainText("accessible seats");

  // The same gap is raised on the Overview, as an Event Health issue (B8, D-107 point 4).
  await page.goto(eventPath);
  const attention = page.getByRole("region", { name: "Needs your attention" });
  await expect(attention).toContainText("Accessibility is Not ready");
  await expect(attention).toContainText("Captioning is not set up");
});

test("6. add the missing resource: Almost ready while arranged, then Ready", async ({ page }) => {
  await page.goto(`${eventPath}/accessibility`);
  await gaps(page).getByRole("link", { name: "Set up Captioning" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Set up Captioning" })).toBeVisible();
  await page.getByRole("radio", { name: "Being arranged" }).check();
  await page.getByRole("button", { name: "Set up" }).click();
  await expect(page.getByText("Captioning is up to date.")).toBeVisible();
  await expect(readiness(page)).toContainText("Status: Almost ready");
  await expect(gaps(page)).toContainText("Captioning is still being arranged; 1 guest needs it.");
  await expect(gaps(page)).toContainText("Keeps the event at Almost ready.");

  await gaps(page).getByRole("link", { name: "Edit Captioning" }).click();
  await page.getByRole("radio", { name: "Available", exact: true }).check();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Captioning is up to date.")).toBeVisible();
  await expect(readiness(page)).toContainText("Status: Ready");
  await expect(readiness(page)).toContainText("2 of 2 Required needs covered.");
  await expect(gaps(page)).toContainText("Nothing is missing. Every need is covered.");

  // No accessibility issue left on the Overview.
  await page.goto(eventPath);
  await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Needs your attention" })).not.toContainText(
    "Accessibility is",
  );
});

test("7. Activity records every change, never the note", async ({ page }) => {
  await page.goto(`${eventPath}/activity`);
  const feed = page.getByRole("main");
  await expect(feed).toContainText(
    /Added an accessibility need for ATT-\d{4}: Accessible seating \(Required\)/,
  );
  await expect(feed).toContainText(
    /Added an accessibility need for ATT-\d{4}: Captioning \(Required\)/,
  );
  await expect(feed).toContainText("Set up Accessible seats: Available, 2 seats");
  await expect(feed).toContainText("Set up Captioning: Being arranged");
  await expect(feed).toContainText("Status: Being arranged → Available");
  await expect(feed).toContainText("Imported 12 attendees from a CSV file");
  await expect(feed).not.toContainText(NOTE);
});

test("8. as a Viewer: readiness is visible, nothing can be changed", async ({ page }) => {
  const eventId = eventPath.split("/").pop()!;
  await addSecondOwner(eventId);
  await setDemoRole(eventId, "VIEWER");

  await page.goto(`${eventPath}/accessibility`);
  await expect(readiness(page)).toContainText("Status: Ready");
  await expect(page.getByRole("link", { name: /^(Set up|Edit) / })).toHaveCount(0);
  await page.goto(`${eventPath}/accessibility/captioning/edit`);
  await expect(page.getByRole("heading", { name: "You don't have access to this" })).toBeVisible();

  // The guest's page shows the need but not its note, and offers no changes.
  await page.goto(remediosPath);
  const section = page.getByRole("region", { name: "Accessibility", exact: true });
  await expect(section).toContainText("Accessible seating");
  await expect(section).not.toContainText(NOTE);
  await expect(page.getByRole("link", { name: "Add accessibility need" })).toHaveCount(0);
  await page.goto(`${remediosPath}/accessibility/new`);
  await expect(page.getByRole("heading", { name: "You don't have access to this" })).toBeVisible();
});