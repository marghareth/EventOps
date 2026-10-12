// e2e/lifecycle/event-lifecycle.spec.ts
// B1-14: the event lifecycle in a real browser, signed in as the dev demo user, against a reset test
// database. Run with `npm run test:e2e:lifecycle` (docs/TESTING.md). The same story runs without a
// browser, with four real users, in src/modules/events/lifecycle.db.test.ts.
import { expect, test, type Page } from "@playwright/test";
import { addSecondOwner, removeDemoMembership, setDemoRole } from "./db";

test.describe.configure({ mode: "serial" });

const NAME = `Lifecycle Gala ${Date.now()}`;
let eventPath = "";
let reference = "";

const header = (page: Page) => page.getByRole("region", { name: "Current event" });

test("1. a signed-in user starts with no events", async ({ page }) => {
  await page.goto("/events");
  await expect(page.getByRole("heading", { name: "No events yet" })).toBeVisible();
});

test("2. create an event and land on its workspace", async ({ page }) => {
  await page.goto("/events/new");
  await page.getByLabel(/Event name/).fill(NAME);
  await page.getByLabel(/^Date/).fill("2099-12-12");
  await page.getByLabel(/^Start time/).fill("16:00");
  await page.getByLabel(/Venue \(optional\)/).fill("Cebu");
  await page.getByLabel(/Expected attendees/).fill("180");
  await page.getByRole("button", { name: "Create event" }).click();

  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}\?created=EVT-\d{4}-\d{4,}$/);
  const url = new URL(page.url());
  eventPath = url.pathname;
  reference = url.searchParams.get("created") ?? "";
  await expect(page.getByText("Event created")).toBeVisible();
  await expect(header(page)).toContainText(NAME);
});

test("3. the event appears in the event list and opens from there", async ({ page }) => {
  await page.goto("/events");
  await page.getByRole("link", { name: NAME }).click();
  await expect(page).toHaveURL(new RegExp(`${eventPath}$`));
  await expect(header(page)).toContainText(reference);
  await expect(header(page)).toContainText("Owner");
});

test("4. edit the event; the workspace shows the change at once", async ({ page }) => {
  await page.goto(`${eventPath}/settings`);
  await page.getByLabel(/Venue \(optional\)/).fill("Manila");
  await page.getByLabel(/Expected attendees/).fill("220");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Changes saved.")).toBeVisible();
  await expect(header(page)).toContainText("Manila");
});

test("5. the activity feed shows the edit and the creation, newest first", async ({ page }) => {
  await page.goto(`${eventPath}/activity`);
  const entries = page.locator("main ol > li");
  await expect(entries).toHaveCount(2);
  await expect(entries.nth(0)).toContainText("Edited the event details");
  await expect(entries.nth(0)).toContainText("Venue: “Cebu” → “Manila”");
  await expect(entries.nth(0)).toContainText("Expected attendees: 180 → 220");
  await expect(entries.nth(1)).toContainText(`Created the event ${reference}`);
});

test("6. as a Coordinator: can edit and see activity, cannot delete", async ({ page }) => {
  const eventId = eventPath.split("/").pop()!;
  await addSecondOwner(eventId);
  await setDemoRole(eventId, "COORDINATOR");

  await page.goto(`${eventPath}/settings`);
  await expect(page.getByText(/Your role: Coordinator\./)).toBeVisible();
  await expect(page.getByRole("button", { name: "Save changes" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Delete event" })).toHaveCount(0);

  await page.getByLabel(/Venue \(optional\)/).fill("Iloilo");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Changes saved.")).toBeVisible();

  await page.goto(`${eventPath}/activity`);
  await expect(page.locator("main ol > li")).toHaveCount(3);
});

test("7. as a Viewer: read-only everywhere, no activity", async ({ page }) => {
  const eventId = eventPath.split("/").pop()!;
  await setDemoRole(eventId, "VIEWER");

  await page.goto(eventPath);
  await expect(header(page)).toContainText("Viewer");
  await expect(page.getByRole("link", { name: "Edit event" })).toHaveCount(0);

  await page.goto(`${eventPath}/settings`);
  await expect(page.getByText(/Your role: Viewer\./)).toBeVisible();
  await expect(page.getByRole("main").getByRole("textbox")).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("button")).toHaveCount(0);

  await page.goto(`${eventPath}/activity`);
  await expect(page.getByRole("heading", { name: "You don't have access to this" })).toBeVisible();

  expect((await page.request.get(`/api${eventPath}`)).status()).toBe(200);
});

test("8. no longer a member: the event is gone from view, as if it didn't exist", async ({
  page,
}) => {
  const eventId = eventPath.split("/").pop()!;
  await removeDemoMembership(eventId);

  const response = await page.goto(`${eventPath}/settings`);
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  expect((await page.request.get(`/api${eventPath}`)).status()).toBe(404);

  await page.goto("/events");
  await expect(page.getByRole("link", { name: NAME })).toHaveCount(0);
});

test("9. as an Owner again: delete after typing the event number; it disappears", async ({
  page,
}) => {
  const eventId = eventPath.split("/").pop()!;
  await setDemoRole(eventId, "OWNER");

  await page.goto(`${eventPath}/settings`);
  await page.getByRole("region", { name: "Delete event" }).getByRole("button").click();
  const dialog = page.getByRole("alertdialog", { name: "Delete this event?" });
  await expect(dialog.getByRole("button", { name: "Delete event" })).toBeDisabled();
  await dialog.getByRole("textbox").fill(reference);
  await dialog.getByRole("button", { name: "Delete event" }).click();

  await expect(page).toHaveURL(/\/events\?deleted=/);
  await expect(page.getByText("Event deleted")).toBeVisible();
  await expect(page.getByRole("link", { name: NAME })).toHaveCount(0);
  expect((await page.goto(eventPath))?.status()).toBe(404);
  expect((await page.request.get(`/api${eventPath}`)).status()).toBe(404);
});