// e2e/lifecycle/accessibility-review.spec.ts
// B10-F19, F20 (D-116): the accessibility and cross-screen review, automated. Every core screen,
// with real data, is checked with axe (WCAG 2.2 A and AA rules) at desktop width, and for sideways
// scrolling at phone (375 px) and tablet (768 px) widths. Interactive states are checked too: a form
// with errors, a confirmation dialog, and the import's matching step. Any violation fails the test
// with the rule, the screen and the elements. The manual keyboard and screen reader review is
// recorded in docs/accessibility-review.md.
// Run with `npm run test:e2e:lifecycle` (docs/TESTING.md).
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { resetDemoData } from "../../scripts/reset-demo";
import { firstRecordIds, seedHealthProblems, seedImpactScenario } from "./db";

test.describe.configure({ mode: "serial" });

const database = () => process.env.E2E_DATABASE_URL ?? "";
test.beforeAll(async () => resetDemoData(database()));
test.afterAll(async () => resetDemoData(database()));

const RULES = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const WIDTHS = [375, 768] as const;

let health = "";
let impact = "";
const screens: { name: string; path: () => string }[] = [];

async function createEvent(page: Page, name: string) {
  await page.goto("/events/new");
  await page.getByLabel(/Event name/).fill(name);
  await page.getByLabel(/^Date/).fill("2099-12-12");
  await page.getByLabel(/^Start time/).fill("16:00");
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}\?created=/);
  return new URL(page.url()).pathname;
}

/** axe violations as readable lines: rule, impact and the first elements. */
async function violations(page: Page): Promise<string[]> {
  const result = await new AxeBuilder({ page }).withTags(RULES).analyze();
  // A scan that checked nothing would pass silently; make sure axe really looked at the page.
  expect(result.passes.length).toBeGreaterThan(10);
  return result.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help} → ${v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(" "))
        .join(" | ")}`,
  );
}

async function sideways(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

async function review(page: Page, name: string): Promise<string[]> {
  const found: string[] = [];
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const v of await violations(page)) found.push(`${name} [1280]: ${v}`);
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await sideways(page);
    if (overflow > 0) found.push(`${name} [${width}]: scrolls sideways by ${overflow}px`);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  return found;
}

test("0. sign in and set up two events with real data", async ({ page }) => {
  await page.goto("/login?next=%2Fevents");
  await page.getByLabel(/Email/).fill("coordinator@example.com");
  await page.getByLabel(/Password/).fill("a-long-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/events$/);
  health = await createEvent(page, `Review: health ${Date.now()}`);
  impact = await createEvent(page, `Review: impact ${Date.now()}`);
  await seedHealthProblems(health.split("/").pop()!);
  await seedImpactScenario(impact.split("/").pop()!);
  const ids = await firstRecordIds(health.split("/").pop()!);
  const impactIds = await firstRecordIds(impact.split("/").pop()!);
  const a = () => `${health}/attendees/${ids.attendeeId}`;
  const s = () => `${health}/suppliers/${ids.supplierId}`;
  screens.push(
    { name: "My events", path: () => "/events" },
    { name: "New event", path: () => "/events/new" },
    { name: "Overview", path: () => health },
    { name: "Health", path: () => `${health}/health` },
    { name: "Critical view", path: () => `${health}/health?show=critical` },
    { name: "Attendees", path: () => `${health}/attendees` },
    { name: "Attendee", path: a },
    { name: "Attendee edit", path: () => `${a()}/edit` },
    { name: "Add attendee", path: () => `${health}/attendees/new` },
    { name: "Add accessibility need", path: () => `${a()}/accessibility/new` },
    { name: "Accessibility", path: () => `${impact}/accessibility` },
    { name: "Suppliers", path: () => `${health}/suppliers` },
    { name: "Supplier", path: s },
    { name: "Supplier edit", path: () => `${s()}/edit` },
    { name: "Add quote", path: () => `${s()}/quotes/new` },
    { name: "Add payment", path: () => `${s()}/payments/new` },
    { name: "Budget", path: () => `${impact}/budget` },
    { name: "Add budget category", path: () => `${impact}/budget/categories/new` },
    { name: "Add budget item", path: () => `${impact}/budget/items/new` },
    { name: "Tasks", path: () => `${health}/tasks` },
    { name: "Tasks, overdue only", path: () => `${health}/tasks?overdue=only` },
    { name: "Edit task", path: () => `${impact}/tasks/${impactIds.taskId}/edit` },
    { name: "Add task", path: () => `${health}/tasks/new` },
    { name: "Impact", path: () => `${impact}/impact` },
    { name: "Import", path: () => `${health}/import` },
    { name: "Activity", path: () => `${health}/activity` },
    { name: "Settings", path: () => `${health}/settings` },
  );
});

test("1. every core screen passes axe and doesn't scroll sideways", async ({ page }) => {
  test.setTimeout(600_000);
  const found: string[] = [];
  for (const screen of screens) {
    await page.goto(screen.path());
    await expect(page.locator("#main h1").first()).toBeVisible();
    found.push(...(await review(page, screen.name)));
  }
  expect(found, found.join("\n")).toEqual([]);
});

test("2. interactive states: form errors, a confirmation dialog, the import's matching", async ({
  page,
}) => {
  const found: string[] = [];

  await page.goto(`${health}/tasks/new`);
  await page.getByRole("button", { name: /Add task/ }).click();
  await expect(page.getByRole("group", { name: "Fix these to continue" })).toBeFocused();
  found.push(...(await review(page, "Add task with errors")));

  await page.goto(`${impact}/budget`);
  await page.getByRole("button", { name: /^Delete category Catering/ }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  found.push(...(await review(page, "Budget delete dialog")));
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  // Focus goes back to the button that opened the dialog.
  await expect(page.getByRole("button", { name: /^Delete category Catering/ })).toBeFocused();

  const file = join(mkdtempSync(join(tmpdir(), "eventops-e2e-")), "guests.csv");
  writeFileSync(
    file,
    "Guest Name,E-mail,RSVP\r\nAna Reyes,ana@example.com,Yes\r\nBad,x,perhaps\r\n",
  );
  await page.goto(`${health}/import`);
  await page.getByLabel("CSV or Excel file").setInputFiles(file);
  await page.getByRole("button", { name: "Upload and continue" }).click();
  await expect(page.getByRole("heading", { name: "2. Match your columns" })).toBeFocused();
  found.push(...(await review(page, "Import matching")));
  await page.getByRole("button", { name: "Preview the import" }).click();
  await expect(page.getByRole("heading", { name: "3. Check before importing" })).toBeFocused();
  found.push(...(await review(page, "Import preview")));

  expect(found, found.join("\n")).toEqual([]);
});

/** Tabs through the page; every stop must be visible and show the focus ring (B10-F10, F12). */
async function keyboardFindings(page: Page, name: string, stops = 40): Promise<string[]> {
  const found: string[] = [];
  const seen: string[] = [];
  for (let i = 0; i < stops; i += 1) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      // The Next.js dev tools button (development only) comes after the page: stop there.
      if (
        !el ||
        el === document.body ||
        el.closest("nextjs-portal") ||
        el.tagName === "NEXTJS-PORTAL"
      )
        return null;
      // Inside a native date or time field, Tab can reach the browser's own picker button: the
      // field stays the active element but no longer matches :focus. Chrome draws that ring itself.
      if (!el.matches(":focus")) return { label: "native", ring: true, size: 1 };
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const ring =
        (style.boxShadow !== "none" && style.boxShadow !== "") ||
        (style.outlineStyle !== "none" &&
          parseFloat(style.outlineWidth) > 0 &&
          !/rgba\(0, 0, 0, 0\)|transparent/.test(style.outlineColor));
      const label = (el.getAttribute("aria-label") ?? el.textContent ?? el.tagName)
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 50);
      const kind = el instanceof HTMLInputElement ? `[${el.type} ${el.name}]` : "";
      return {
        label: `${el.tagName.toLowerCase()}${kind} “${label}”`,
        ring,
        size: rect.width * rect.height,
      };
    });
    if (!info) break;
    if (i === 0 && !/Skip to main content/.test(info.label)) {
      found.push(`${name}: the first Tab stop is ${info.label}, not the skip link`);
    }
    if (!info.ring) found.push(`${name}: no visible focus on ${info.label}`);
    if (info.size === 0) found.push(`${name}: focus on a hidden element ${info.label}`);
    seen.push(info.label);
  }
  if (seen.length === 0) found.push(`${name}: nothing can be reached with Tab`);
  return found;
}

/** At phone width, buttons and form controls in the page are at least 44 px tall (D-116). */
async function targetFindings(page: Page, name: string): Promise<string[]> {
  await page.setViewportSize({ width: 375, height: 900 });
  const small = await page
    .locator(
      "#main button:visible, #main select:visible, #main textarea:visible, #main input:visible:not([type=checkbox]):not([type=radio]):not([type=hidden]), #main a[data-slot=button]:visible",
    )
    .evaluateAll((elements) =>
      elements
        .map((el) => ({
          text: (el.getAttribute("aria-label") ?? el.textContent ?? el.tagName).trim().slice(0, 40),
          h: Math.round(el.getBoundingClientRect().height),
        }))
        .filter((c) => c.h > 0 && c.h < 44),
    );
  await page.setViewportSize({ width: 1280, height: 900 });
  return small.map((c) => `${name} [375]: “${c.text}” is ${c.h}px tall`);
}

test("3. keyboard: skip link first, every stop visible with a focus ring; 44 px targets", async ({
  page,
}) => {
  test.setTimeout(600_000);
  const found: string[] = [];
  for (const screen of screens) {
    await page.goto(screen.path());
    await expect(page.locator("#main h1").first()).toBeVisible();
    found.push(...(await keyboardFindings(page, screen.name)));
    found.push(...(await targetFindings(page, screen.name)));
  }
  expect(found, found.join("\n")).toEqual([]);
});