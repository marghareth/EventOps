// e2e/lifecycle/health-flow.spec.ts
// B8: Event Health in a real browser against PostgreSQL. A new event has nothing to check. Then the
// event gets real problems (a guest who hasn't replied, an unconfirmed supplier with an overdue
// deposit, an overdue High-priority task): the Overview turns At risk, lists the issues Critical
// first with recent activity, links to the Critical view, and each critical issue says why and links
// to the section that fixes it. The Health page shows every check at phone and desktop widths with
// no sideways scroll and 44 px controls. A Viewer sees the same health but no recent activity.
// Run with `npm run test:e2e:lifecycle` (docs/TESTING.md).
import { expect, test, type Page } from "@playwright/test";
import { resetDemoData } from "../../scripts/reset-demo";
import { addSecondOwner, seedHealthProblems, setDemoRole } from "./db";

test.describe.configure({ mode: "serial" });

const EVENT = `Santos–Lim Wedding (health) ${Date.now()}`;
let eventPath = "";
let eventId = "";

const database = () => process.env.E2E_DATABASE_URL ?? "";
test.beforeAll(async () => resetDemoData(database()));
test.afterAll(async () => resetDemoData(database()));

const attention = (page: Page) => page.getByRole("list", { name: "Needs your attention" });

async function noSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

async function linksAndControlsAre44px(page: Page) {
  const small = await page.locator("main a:visible, main button:visible").evaluateAll((elements) =>
    elements
      .map((el) => ({ text: el.textContent, h: el.getBoundingClientRect().height }))
      // Summary tiles and section tiles are taller; plain inline links are checked here too.
      .filter((c) => c.h < 44),
  );
  expect(small).toEqual([]);
}

test("1. a new event has nothing to check yet", async ({ page }) => {
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

  const health = page.getByRole("region", { name: "Event health" });
  await expect(health).toContainText("Nothing to check yet");
  await expect(page.getByText("Nothing to check yet.")).toBeVisible();
  // The Owner sees recent activity: the event's creation.
  await expect(page.getByRole("region", { name: "Recent activity" })).toContainText(
    "Created the event",
  );
});

test("2. with real problems the Overview turns At risk, Critical first", async ({ page }) => {
  await seedHealthProblems(eventId);
  await page.goto(eventPath);
  await expect(page.getByRole("region", { name: "Event health" })).toContainText("At risk");
  const items = attention(page).getByRole("listitem");
  await expect(items.first()).toContainText("Critical");
  await expect(items.first()).toContainText("1 payment is overdue");
  await expect(attention(page)).toContainText("1 task is overdue, 1 High priority");
  await expect(attention(page)).toContainText("1 guest hasn't replied yet");
  await expect(page.getByRole("list", { name: "Event summary" })).toContainText("0 of 1");
});

test("3. the Critical view explains each issue and links to the fix", async ({ page }) => {
  await page.goto(eventPath);
  await page.getByRole("link", { name: "View 2 critical issues" }).click();
  await expect(page).toHaveURL(/\/health\?show=critical$/);
  await expect(page.getByRole("heading", { level: 1, name: "Critical issues" })).toBeVisible();
  const critical = page.getByRole("list", { name: "Critical issues" }).getByRole("listitem");
  await expect(critical).toHaveCount(2);
  await expect(critical.first()).toContainText("Casa Verde Catering (SUP-0001)");
  await expect(critical.nth(1)).toContainText("An overdue High-priority task makes this Critical.");
  await critical.first().getByRole("link", { name: "Open Suppliers" }).click();
  await expect(page).toHaveURL(new RegExp(`${eventPath}/suppliers$`));
});

test("4. the Health page shows every check from the sidebar", async ({ page }) => {
  await page.goto(eventPath);
  await page.getByRole("link", { name: "Health", exact: true }).first().click();
  await expect(page).toHaveURL(new RegExp(`${eventPath}/health$`));
  for (const area of ["Attendees", "Suppliers", "Budget", "Accessibility", "Tasks"]) {
    await expect(page.getByRole("region", { name: area })).toBeVisible();
  }
  await expect(page.getByRole("region", { name: "Budget" })).toContainText("Not checked");
});

for (const width of [375, 1280]) {
  test(`5. usable at ${width} px: no sideways scroll, 44 px links and buttons`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [eventPath, `${eventPath}/health`, `${eventPath}/health?show=critical`]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await noSidewaysScroll(page);
      await linksAndControlsAre44px(page);
    }
  });
}

test("6. a Viewer sees the same health but no recent activity", async ({ page }) => {
  await addSecondOwner(eventId);
  await setDemoRole(eventId, "VIEWER");
  await page.goto(eventPath);
  await expect(page.getByRole("region", { name: "Event health" })).toContainText("At risk");
  await expect(attention(page)).toContainText("1 payment is overdue");
  await expect(page.getByRole("region", { name: "Recent activity" })).toHaveCount(0);
});