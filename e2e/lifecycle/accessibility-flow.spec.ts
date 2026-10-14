// e2e/lifecycle/accessibility-flow.spec.ts
// B3-04, B3-05: an attendee's accessibility needs and the event's resources in a real browser, signed in as the dev demo user
// (D-024), against a reset test database: add two needs (choosing with the keyboard), see them on
// the attendee's details page, edit one, remove one, and find each change in Activity without the
// note; then set up, edit and remove an event resource; then readiness and its alerts (B3-10, B3-11). Run with `npm run test:e2e:lifecycle` (docs/TESTING.md); CI runs it in the "e2e" job.
import { expect, test } from "@playwright/test";
import { resetDemoData } from "../../scripts/reset-demo";

test.describe.configure({ mode: "serial" });

const EVENT = `Accessibility Flow ${Date.now()}`;
let attendeePath = "";

const database = () => process.env.E2E_DATABASE_URL ?? "";
test.beforeAll(async () => resetDemoData(database()));
test.afterAll(async () => resetDemoData(database()));

test("1. an attendee starts with no accessibility needs", async ({ page }) => {
  await page.goto("/events/new");
  await page.getByLabel(/Event name/).fill(EVENT);
  await page.getByLabel(/^Date/).fill("2099-12-12");
  await page.getByLabel(/^Start time/).fill("16:00");
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}\?created=/);
  const eventPath = new URL(page.url()).pathname;

  await page.goto(`${eventPath}/attendees/new`);
  await page.getByLabel(/^Name/).fill("Maria Santos");
  await page.getByRole("button", { name: "Add attendee" }).click();
  await page.getByRole("link", { name: "Maria Santos" }).click();
  await expect(page).toHaveURL(/\/attendees\/[0-9a-f-]{36}$/);
  attendeePath = new URL(page.url()).pathname;

  const section = page.getByRole("region", { name: "Accessibility" });
  await expect(section).toContainText("No accessibility needs recorded for Maria Santos.");
});

test("2. add two needs, choosing the first with the keyboard", async ({ page }) => {
  await page.goto(attendeePath);
  await page.getByRole("link", { name: "Add accessibility need" }).click();
  await expect(
    page.getByRole("heading", { name: "Add an accessibility need for Maria Santos" }),
  ).toBeVisible();

  // Native radio group: focus the first choice, arrow down to the next.
  await page.getByRole("radio", { name: /^Mobility assistance/ }).focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("radio", { name: /^Accessible seating/ })).toBeChecked();
  await page.getByLabel("Note").fill("Near the aisle");
  await page.getByRole("button", { name: "Add need" }).click();

  await expect(page.getByText("Accessibility need added")).toBeVisible();
  await page.getByRole("link", { name: "Add accessibility need" }).click();
  await expect(
    page.getByRole("radio", { name: /Accessible seating \(already added\)/ }),
  ).toBeDisabled();
  await page.getByRole("radio", { name: /^Other/ }).check();
  await page.getByRole("button", { name: "Add need" }).click();
  // Other needs a note: the server refuses and says so next to the field.
  await expect(page.getByText("Describe what the guest needs.").first()).toBeVisible();
  await page.getByLabel("Note").fill("Guide dog");
  await page.getByRole("radio", { name: /For information/ }).check();
  await page.getByRole("button", { name: "Add need" }).click();

  const section = page.getByRole("region", { name: "Accessibility" });
  await expect(section).toContainText("2 needs recorded.");
  await expect(section.getByRole("listitem").first()).toContainText("Accessible seating");
  await expect(section.getByRole("listitem").first()).toContainText("Near the aisle");
  await expect(section.getByRole("listitem").nth(1)).toContainText("For information");
});

test("3. edit one need and remove the other", async ({ page }) => {
  await page.goto(attendeePath);
  await page.getByRole("link", { name: "Edit Accessible seating" }).click();
  await page.getByRole("radio", { name: /^Preferred/ }).check();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Accessible seating is up to date.")).toBeVisible();
  await expect(page.getByRole("region", { name: "Accessibility" })).toContainText("Preferred");

  await page.getByRole("link", { name: "Edit Other" }).click();
  await page.getByRole("button", { name: "Remove need" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Remove this accessibility need?" });
  await dialog.getByRole("button", { name: "Remove need" }).click();
  await expect(
    page.getByText("Other is no longer on this guest's accessibility needs."),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Accessibility" })).toContainText(
    "1 need recorded.",
  );
});

test("4. Activity records each change, never the notes", async ({ page }) => {
  await page.goto(attendeePath.replace(/\/attendees\/.*/, "/activity"));
  const feed = page.getByRole("main");
  await expect(feed).toContainText(
    "Added an accessibility need for ATT-0001: Accessible seating (Required)",
  );
  await expect(feed).toContainText("Edited an accessibility need of ATT-0001: Accessible seating");
  await expect(feed).toContainText("Priority: Required → Preferred");
  await expect(feed).toContainText("Removed an accessibility need from ATT-0001: Other");
  await expect(feed).not.toContainText("Near the aisle");
  await expect(feed).not.toContainText("Guide dog");
});

test("5. set up, edit and remove an event resource", async ({ page }) => {
  const accessibility = attendeePath.replace(/\/attendees\/.*/, "/accessibility");
  await page.goto(accessibility);
  // The resources section; the gaps above it may offer the same fix links (B3-10).
  const provides = page.getByRole("region", { name: "What the event provides" });
  await expect(provides.getByText(/None of the six resources is set up yet\./)).toBeVisible();

  await provides.getByRole("link", { name: "Set up Accessible seats" }).click();
  await page.getByRole("radio", { name: "Being arranged" }).check();
  await page.getByRole("button", { name: "Set up" }).click();
  // Accessible seats need a count: the server refuses and says so beside the field.
  await expect(page.getByText("Enter how many seats", { exact: false }).first()).toBeVisible();
  await page.getByLabel(/^Number of accessible seats/).fill("6");
  await page.getByRole("button", { name: "Set up" }).click();
  await expect(page.getByText("Accessible seats is up to date.")).toBeVisible();
  const seats = provides.getByRole("listitem").filter({ hasText: "Accessible seats" });
  await expect(seats).toContainText("Being arranged");
  await expect(seats).toContainText("6 seats");

  await provides.getByRole("link", { name: "Edit Accessible seats" }).click();
  await page.getByRole("radio", { name: "Available", exact: true }).check();
  await page.getByLabel(/^Number of accessible seats/).fill("8");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(seats).toContainText("Available");
  await expect(seats).toContainText("8 seats");

  await provides.getByRole("link", { name: "Edit Accessible seats" }).click();
  await page.getByRole("button", { name: "Remove resource" }).click();
  await page
    .getByRole("alertdialog", { name: "Remove this resource?" })
    .getByRole("button", { name: "Remove resource" })
    .click();
  await expect(page.getByText("Accessible seats is not set up any more.")).toBeVisible();

  await page.goto(accessibility.replace(/\/accessibility$/, "/activity"));
  const feed = page.getByRole("main");
  await expect(feed).toContainText("Set up Accessible seats: Being arranged, 6 seats");
  await expect(feed).toContainText("Seats: 6 → 8");
  await expect(feed).toContainText("Removed Accessible seats");
});

test("6. readiness: a Required need without a resource makes the event Not ready", async ({
  page,
}) => {
  const accessibility = attendeePath.replace(/\/attendees\/.*/, "/accessibility");
  // After step 3 the guest's only need is Preferred seating, which never decides readiness.
  await page.goto(accessibility);
  const readiness = page.getByRole("region", { name: "Accessibility readiness" });
  await expect(readiness).toContainText("No required needs");

  await page.goto(`${attendeePath}/accessibility/new`);
  await page.getByRole("radio", { name: "Captioning", exact: true }).check();
  await page.getByRole("button", { name: "Add need" }).click();
  await expect(page.getByText("Accessibility need added")).toBeVisible();

  await page.goto(accessibility);
  await expect(readiness).toContainText("Not ready");
  const gaps = page.getByRole("region", { name: "What's missing" });
  await expect(gaps).toContainText("Captioning is not set up, but 1 guest needs it.");
  await expect(gaps).toContainText("Makes the event Not ready.");

  // B3-11: the alert on the event Overview and on the guest's page.
  const overview = accessibility.replace(/\/accessibility$/, "");
  await page.goto(overview);
  const alert = page.getByRole("region", { name: "Accessibility alert" });
  await expect(alert).toContainText("Accessibility: Not ready");
  await expect(alert).toContainText("Captioning is not set up");
  await page.goto(attendeePath);
  const guestAlerts = page.getByRole("region", { name: "Alerts about this guest's needs" });
  await expect(guestAlerts).toContainText("Captioning is not set up, but 1 guest needs it.");
  await guestAlerts.getByRole("link", { name: "Set up Captioning" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Set up Captioning" })).toBeVisible();

  await page.goto(accessibility);
  await gaps.getByRole("link", { name: "Set up Captioning" }).click();
  await page.getByRole("radio", { name: "Available", exact: true }).check();
  await page.getByRole("button", { name: "Set up" }).click();
  await expect(page.getByText("Captioning is up to date.")).toBeVisible();
  // Captioning covered; the Preferred seating need without seats stays as advice only.
  await expect(readiness).toContainText("Ready");
  await expect(readiness).not.toContainText("Not ready");
  await expect(gaps).toContainText("Accessible seats is not set up, but 1 guest needs it.");
  await expect(gaps).toContainText("Advice only");

  // Ready: no alert on the Overview, and none for the guest (Preferred advice never alerts).
  await page.goto(overview);
  await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Accessibility alert" })).toHaveCount(0);
  await page.goto(attendeePath);
  await expect(page.getByRole("heading", { level: 1, name: "Maria Santos" })).toBeVisible();
  await expect(guestAlerts).toHaveCount(0);
});