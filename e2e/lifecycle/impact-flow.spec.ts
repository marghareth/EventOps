// e2e/lifecycle/impact-flow.spec.ts
// B7: Impact Detection in a real browser against PostgreSQL. The brand book's demo: a wedding at 180
// expected guests in a 200-seat venue. Sign in, open Impact from the sidebar, try an invalid number,
// try 220 and see Seating as Critical with catering not yet estimated, set the assumptions with the
// keyboard, see catering at ₱12,000.00 and the catering budget pushed over, save the analysis to
// the history, find it in Activity, and confirm the event itself still says 180. Then the same page
// at phone and desktop widths with no sideways scroll and 44 px controls, and as a Viewer (results,
// no Save buttons, read-only assumptions). Run with `npm run test:e2e:lifecycle` (docs/TESTING.md).
import { expect, test, type Page } from "@playwright/test";
import { resetDemoData } from "../../scripts/reset-demo";
import { addSecondOwner, seedImpactScenario, setDemoRole, storedImpactState } from "./db";

test.describe.configure({ mode: "serial" });

const EVENT = `Santos–Lim Wedding (impact) ${Date.now()}`;
let eventPath = "";
let eventId = "";

const database = () => process.env.E2E_DATABASE_URL ?? "";
test.beforeAll(async () => resetDemoData(database()));
test.afterAll(async () => resetDemoData(database()));

const impactPath = () => `${eventPath}/impact`;
/** Scoped to main: while Next swaps pages, the old page's copy can still be in the DOM. */
const main = (page: Page) => page.locator("#main");
const results = (page: Page) => main(page).getByRole("list", { name: "Identified impacts" });
const card = (page: Page, title: string | RegExp) =>
  results(page).getByRole("listitem").filter({ hasText: title });

async function noSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

async function controlsAre44px(page: Page) {
  const small = await page
    .locator("main button:visible, main input:not([type=hidden]):visible, main select:visible")
    .evaluateAll((elements) =>
      elements
        .map((el) => ({
          name: el.getAttribute("name") ?? el.textContent,
          h: el.getBoundingClientRect().height,
        }))
        .filter((c) => c.h < 44),
    );
  expect(small).toEqual([]);
}

test("1. sign in, create the event and open Impact from the sidebar", async ({ page }) => {
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
  await seedImpactScenario(eventId);

  await page.goto(eventPath);
  await page.getByRole("link", { name: "Impact" }).first().click();
  await expect(page).toHaveURL(new RegExp(`${impactPath()}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Impact" })).toBeVisible();
  await expect(main(page).getByText("Now 180.")).toBeVisible();
  await expect(main(page).getByText("No saved analyses yet")).toBeVisible();
});

test("2. an invalid number is explained on the field", async ({ page }) => {
  await page.goto(impactPath());
  const field = page.getByLabel(/Proposed expected attendees/);
  await field.fill("two hundred");
  await page.getByRole("button", { name: "See the impact" }).click();
  await expect(main(page).getByText("Enter a whole number from 0 to 1,000,000.")).toBeVisible();
  await expect(page.getByLabel(/Proposed expected attendees/)).toHaveAttribute(
    "aria-invalid",
    "true",
  );
});

test("3. 180 → 220: seating is Critical, catering waits for a cost per head", async ({ page }) => {
  await page.goto(impactPath());
  await page.getByLabel(/Proposed expected attendees/).fill("220");
  await page.getByRole("button", { name: "See the impact" }).click();
  await expect(page).toHaveURL(/\?to=220$/);
  await expect(main(page).getByText("This change has critical impacts")).toBeVisible();
  await expect(main(page).getByText("180 → 220 (+40)", { exact: true })).toBeVisible();
  await expect(card(page, "20 more people than the venue holds")).toContainText("Critical");
  await expect(card(page, "Catering cost not estimated")).toContainText("Info");
  await expect(card(page, "1 task may need review")).toContainText("TSK-0001");
});

test("4. set the assumptions with the keyboard; the estimate follows", async ({ page }) => {
  await page.goto(`${impactPath()}?to=220`);
  await page.getByLabel(/Catering cost per head/).focus();
  await page.keyboard.type("300");
  await page.keyboard.press("Tab");
  await page.keyboard.type("4.55");
  await page.keyboard.press("Tab");
  await page.getByLabel(/Catering budget category/).selectOption({ label: "Catering" });
  await page.getByRole("button", { name: "Save assumptions" }).focus();
  await page.keyboard.press("Enter");

  await expect(main(page).getByText("Assumptions saved.")).toBeVisible();
  await expect(page).toHaveURL(/to=220/);
  await expect(card(page, "Catering may increase by ₱12,000.00")).toContainText("Needs attention");
  await expect(card(page, "“Catering” may go over budget by ₱7,000.00")).toContainText("Critical");
  await expect(card(page, "The event stays within budget")).toContainText("Passed");
  await expect(card(page, "About 3 more accessible seats may be needed")).toContainText("Estimate");
});

test("5. save the analysis; the event still says 180", async ({ page }) => {
  await page.goto(`${impactPath()}?to=220`);
  await page.getByRole("button", { name: "Save to history" }).click();
  await expect(main(page).getByText("Analysis IMP-0001 was saved to the history.")).toBeVisible();
  const saved = main(page).getByRole("list", { name: "Saved analyses" });
  await expect(saved).toContainText("IMP-0001");
  await expect(saved).toContainText("Simulation: not a change to the event.");
  await saved.getByText("Expected attendees 180 → 220").click();
  await expect(saved.getByRole("list", { name: "Impacts in IMP-0001" })).toContainText(
    "Catering may increase by ₱12,000.00",
  );

  expect(await storedImpactState(eventId)).toEqual({
    expectedAttendees: 180,
    analyses: [{ number: 1, fromAttendees: 180, toAttendees: 220, overallSeverity: "CRITICAL" }],
  });

  await page.goto(`${eventPath}/activity`);
  await expect(
    main(page).getByText("Saved the impact analysis IMP-0001: expected attendees 180 → 220"),
  ).toBeVisible();
  await expect(main(page).getByText("Changed the impact assumptions")).toBeVisible();
});

for (const width of [375, 1280]) {
  test(`6. usable at ${width} px: no sideways scroll, 44 px controls`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${impactPath()}?to=220`);
    await expect(results(page)).toBeVisible();
    await noSidewaysScroll(page);
    await controlsAre44px(page);
  });
}

test("7. a Viewer sees the results and the history, but can't save or edit", async ({ page }) => {
  // Every event keeps an Owner (D-022), so another Owner joins before the demo user becomes a Viewer.
  await addSecondOwner(eventId);
  await setDemoRole(eventId, "VIEWER");
  await page.goto(`${impactPath()}?to=250`);
  await expect(card(page, "50 more people than the venue holds")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save to history" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save assumptions" })).toHaveCount(0);
  await expect(main(page).getByText("Owners and Coordinators can change these.")).toBeVisible();
  await expect(main(page).getByRole("list", { name: "Saved analyses" })).toContainText("IMP-0001");
});