// e2e/lifecycle/supplier-workflow.spec.ts
// B4-22: the whole supplier workflow in a real browser, against realistic seeded data. Sign in,
// open a Cebu wedding that already has eight suppliers (quotes accepted, pending and declined;
// deposits paid, due and overdue; accents in names), then: create a supplier with its category and
// contact using the keyboard only, add a quote, accept it, add a deposit with a due date, find it
// on the list, search, filter, edit it, and check Activity. What was saved is read back from the
// database exactly as stored. Authorization is checked the way a user could try to get around it:
// another event's look-alike supplier never appears in search or filters and its address shows
// "Page not found"; a Viewer sees the suppliers but can't open any form.
// Run with `npm run test:e2e:lifecycle` (docs/TESTING.md); CI runs it in the "e2e" job.
import { expect, test, type Page } from "@playwright/test";
import { resetDemoData } from "../../scripts/reset-demo";
import { formatCalendarDate, manilaToday } from "../../src/modules/events/suppliers/payment-due";
import {
  addDays,
  addSecondOwner,
  removeDemoMembership,
  seedSuppliers,
  setDemoRole,
  storedSupplierMoney,
  type SeedSupplier,
} from "./db";

test.describe.configure({ mode: "serial" });

const stamp = Date.now();
const EVENT = `Santos–Lim Wedding ${stamp}`;
const OTHER_EVENT = `Another Planner's Wedding ${stamp}`;
const TODAY = manilaToday(new Date());

// Eight suppliers already on the event (SUP-0001 to SUP-0008, QUO-0001 to QUO-0008,
// PAY-0001 to PAY-0007), so the one the test adds is SUP-0009 with QUO-0009 and PAY-0008.
const SEED: SeedSupplier[] = [
  {
    name: "Casa Verde Catering",
    category: "CATERING",
    contactName: "Maricel Uy",
    phone: "0917 555 0101",
    email: "events@casaverde.ph",
    quotes: [
      { amount: "185000.00", status: "ACCEPTED", description: "Package B, 180 guests" },
      { amount: "210000.00", status: "DECLINED", description: "Package C" },
    ],
    payments: [
      { kind: "DEPOSIT", amount: "55500.00", dueIn: -21, paidIn: -20, description: "30% deposit" },
      { kind: "PAYMENT", amount: "129500.00", dueIn: 50, description: "Balance" },
    ],
  },
  {
    name: "Peña Florals",
    category: "FLOWERS_AND_STYLING",
    contactName: "Liza Peña",
    phone: "0918 555 0102",
    quotes: [{ amount: "48000.00", status: "PENDING", description: "Ceremony and reception" }],
  },
  {
    name: "Lapu-Lapu Sound and Lights",
    category: "SOUND_AND_LIGHTS",
    contactName: "Jun Abellana",
    quotes: [{ amount: "35000.00", status: "ACCEPTED" }],
    payments: [{ kind: "DEPOSIT", amount: "10500.00", dueIn: -3 }],
  },
  {
    name: "Shangri-La Mactan",
    category: "VENUE",
    contactName: "Events Office",
    email: "weddings@example.ph",
    quotes: [{ amount: "250000.00", status: "ACCEPTED", description: "Ballroom" }],
    payments: [
      { kind: "DEPOSIT", amount: "125000.00", dueIn: -60, paidIn: -61 },
      { kind: "PAYMENT", amount: "125000.00", dueIn: -5, paidIn: -6 },
    ],
  },
  {
    name: "Lens and Light Studio",
    category: "PHOTO_AND_VIDEO",
    contactName: "Paolo Sy",
    quotes: [{ amount: "60000.50", status: "ACCEPTED" }],
    payments: [{ kind: "DEPOSIT", amount: "18000.15", dueIn: 0 }],
  },
  { name: "Sugbo Fireworks", category: "OTHER", categoryDetail: "Fireworks" },
  {
    name: "Kusina ni Lola Desserts",
    category: "CAKE_AND_DESSERTS",
    contactName: "Nena Villareal",
    quotes: [{ amount: "22500.00", status: "DECLINED" }],
  },
  {
    name: "Island Shuttle Co.",
    category: "TRANSPORT",
    quotes: [{ amount: "18000.00", status: "ACCEPTED", description: "Two vans" }],
    payments: [{ kind: "PAYMENT", amount: "18000.00", dueIn: 10 }],
  },
];

// Another event, which the demo user is not a member of, with a supplier that would match the
// test's searches and filters if anything leaked: same name, accepted quote, overdue deposit.
const LOOK_ALIKE: SeedSupplier[] = [
  {
    name: "Peña Florals",
    category: "FLOWERS_AND_STYLING",
    contactName: "Gina Peña",
    phone: "0999 555 0199",
    quotes: [{ amount: "52000.00", status: "PENDING" }],
    payments: [{ kind: "DEPOSIT", amount: "9000.00", dueIn: -2 }],
  },
  {
    name: "Bisaya Brass Band",
    category: "ENTERTAINMENT",
    contactName: "Outside Contact",
    quotes: [{ amount: "99000.00", status: "ACCEPTED" }],
    payments: [{ kind: "DEPOSIT", amount: "9900.00", dueIn: -1 }],
  },
];

const NEW_SUPPLIER = "Bisaya Brass Band";
const EDITED_NAME = "Bisaya Brass Band Cebu";
const DEPOSIT_DUE = addDays(TODAY, 14);

let eventPath = "";
let eventId = "";
let otherEventId = "";
let lookAlikeId = "";
let supplierPath = "";

const database = () => process.env.E2E_DATABASE_URL ?? "";
test.beforeAll(async () => resetDemoData(database()));
test.afterAll(async () => resetDemoData(database()));

const suppliersPath = () => `${eventPath}/suppliers`;
const card = (page: Page, name: string) =>
  page.getByRole("listitem").filter({ has: page.getByRole("link", { name, exact: true }) });

/** Visible text only: while Next swaps pages, the old page's copy can still be in the DOM, hidden. */
const shown = (page: Page, text: string) =>
  page.getByText(text, { exact: true }).filter({ visible: true });

async function createEvent(page: Page, name: string): Promise<string> {
  await page.goto("/events/new");
  await page.getByLabel(/Event name/).fill(name);
  await page.getByLabel(/^Date/).fill("2099-12-12");
  await page.getByLabel(/^Start time/).fill("16:00");
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}\?created=/);
  return new URL(page.url()).pathname;
}

test("1. sign in; the event already holds eight suppliers from months of planning", async ({
  page,
}) => {
  await page.goto("/login?next=%2Fevents");
  await page.getByLabel(/Email/).fill("coordinator@example.com");
  await page.getByLabel(/Password/).fill("a-long-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/events$/);

  eventPath = await createEvent(page, EVENT);
  eventId = eventPath.split("/").pop()!;
  await seedSuppliers(eventId, TODAY, SEED);

  // Someone else's event: the demo user creates it, hands it to another Owner and leaves.
  const otherPath = await createEvent(page, OTHER_EVENT);
  otherEventId = otherPath.split("/").pop()!;
  const ids = await seedSuppliers(otherEventId, TODAY, LOOK_ALIKE);
  lookAlikeId = ids["Peña Florals"];
  await addSecondOwner(otherEventId);
  await removeDemoMembership(otherEventId);
});

test("2. open the event from the event list, then its suppliers", async ({ page }) => {
  await page.goto("/events");
  await expect(page.getByRole("link", { name: OTHER_EVENT })).toHaveCount(0);
  await page.getByRole("link", { name: EVENT }).click();
  await expect(page).toHaveURL(new RegExp(`${eventPath}$`));
  await page.getByRole("link", { name: "Suppliers" }).first().click();
  await expect(page).toHaveURL(new RegExp(`${suppliersPath()}$`));
  await expect(shown(page, "8 suppliers")).toBeVisible();
  await expect(card(page, "Casa Verde Catering")).toContainText("₱185,000.00 accepted");
  await expect(card(page, "Casa Verde Catering")).toContainText("Partially paid");
  await expect(card(page, "Lapu-Lapu Sound and Lights")).toContainText("Overdue");
  await expect(card(page, "Lens and Light Studio")).toContainText("Due today");
  await expect(card(page, "Shangri-La Mactan")).toContainText("Paid");
});

test("3. create a supplier with its category and contact, using only the keyboard", async ({
  page,
}) => {
  await page.goto(suppliersPath());
  const add = page.getByRole("link", { name: "Add supplier" });
  await add.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "Add a supplier" })).toBeVisible();

  // Tab order follows the form: name, category, contact person, phone, email, notes, Add.
  await page.getByLabel(/^Name/).focus();
  await page.keyboard.type(NEW_SUPPLIER);
  await page.keyboard.press("Tab");
  await expect(page.getByLabel(/^Category/)).toBeFocused();
  await page.keyboard.type("Entertainment");
  await expect(page.getByLabel(/^Category/)).toHaveValue("ENTERTAINMENT");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel(/^Contact person/)).toBeFocused();
  await page.keyboard.type("Ramon Dela Cruz");
  await page.keyboard.press("Tab");
  await page.keyboard.type("0917 555 0109");
  await page.keyboard.press("Tab");
  await page.keyboard.type("bookings@bisayabrass.ph");
  await page.keyboard.press("Tab");
  await page.keyboard.type("Plays the processional");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Add supplier" })).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/suppliers\?added=SUP-0009$/);
  await expect(
    page.getByText(`${NEW_SUPPLIER} is on the supplier list as SUP-0009.`),
  ).toBeVisible();
  await expect(card(page, NEW_SUPPLIER)).toContainText("Entertainment");
  await expect(card(page, NEW_SUPPLIER)).toContainText("Ramon Dela Cruz");
  // The list shows the contact person only, never the phone or email (D-073).
  await expect(card(page, NEW_SUPPLIER)).not.toContainText("0917 555 0109");

  await page.getByRole("link", { name: NEW_SUPPLIER, exact: true }).click();
  await expect(page).toHaveURL(/\/suppliers\/[0-9a-f-]{36}$/);
  supplierPath = new URL(page.url()).pathname;
  const contact = page.getByRole("region", { name: "Contact" });
  await expect(contact).toContainText("Ramon Dela Cruz");
  await expect(contact).toContainText("0917 555 0109");
  await expect(contact).toContainText("bookings@bisayabrass.ph");
});

test("4. add a quote, with the keyboard, then accept it", async ({ page }) => {
  await page.goto(supplierPath);
  const quotes = page.getByRole("region", { name: "Quotes" });
  await expect(quotes).toContainText("No quotes yet.");
  await quotes.getByRole("link", { name: "Add quote" }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { level: 1, name: `Add a quote from ${NEW_SUPPLIER}` }),
  ).toBeVisible();
  await page.getByLabel(/^Amount/).focus();
  await page.keyboard.type("38,500");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel(/^Status/)).toHaveValue("PENDING");
  await page.keyboard.press("Tab");
  await page.keyboard.type("Church and reception, 4 hours");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\?quoteAdded=QUO-0009$/);
  await expect(quotes).toContainText("₱38,500.00");
  await expect(quotes).toContainText("Pending");

  // Update the quote's status: the couple said yes.
  await quotes.getByRole("link", { name: "Edit QUO-0009" }).click();
  await expect(page.getByLabel(/^Amount/)).toHaveValue("38,500.00");
  await page.getByLabel(/^Status/).selectOption("Accepted");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL(/\?quoteSaved=QUO-0009$/);
  await expect(quotes).toContainText("Accepted");
  const payments = page.getByRole("region", { name: "Deposits and payments" });
  await expect(payments).toContainText("Payment status: Unpaid");
  await expect(payments).toContainText("₱0.00 paid of the accepted ₱38,500.00 quote");
});

test("5. add the deposit and set its due date", async ({ page }) => {
  await page.goto(supplierPath);
  const payments = page.getByRole("region", { name: "Deposits and payments" });
  await payments.getByRole("link", { name: "Add payment" }).click();
  await expect(page.getByLabel(/^Kind/)).toHaveValue("DEPOSIT");
  await page.getByLabel(/^Amount/).fill("11,550");
  await page.getByLabel(/^Due date/).fill(DEPOSIT_DUE);
  await page.getByLabel(/^Description/).fill("30% to book the date");
  await page.getByRole("button", { name: "Add payment" }).click();
  await expect(page).toHaveURL(/\?paymentAdded=PAY-0008$/);
  await expect(payments).toContainText("PAY-0008");
  await expect(payments).toContainText("₱11,550.00");
  await expect(payments).toContainText(formatCalendarDate(DEPOSIT_DUE));
  await expect(payments).toContainText("Due status: Upcoming");
  await expect(payments).toContainText("Payment status: Unpaid");
});

test("6. what was saved persists: after a reload, and exactly as stored", async ({ page }) => {
  await page.goto(supplierPath);
  await page.reload();
  await expect(page.getByRole("region", { name: "Quotes" })).toContainText("₱38,500.00");
  await expect(page.getByRole("region", { name: "Deposits and payments" })).toContainText(
    formatCalendarDate(DEPOSIT_DUE),
  );

  expect(await storedSupplierMoney(eventId, NEW_SUPPLIER)).toEqual({
    quotes: [{ number: 9, amount: "38500.00", status: "ACCEPTED" }],
    payments: [
      { kind: "DEPOSIT", amount: "11550.00", dueDate: DEPOSIT_DUE, status: "UNPAID", paidOn: null },
    ],
  });
  // The seeded suppliers kept their own exact values.
  const lens = await storedSupplierMoney(eventId, "Lens and Light Studio");
  expect(lens.quotes).toMatchObject([{ amount: "60000.50", status: "ACCEPTED" }]);
  expect(lens.payments[0]).toMatchObject({ amount: "18000.15", dueDate: TODAY });
});

test("7. the supplier list shows the new supplier's quote, payment status and due date", async ({
  page,
}) => {
  await page.goto(suppliersPath());
  await expect(shown(page, "9 suppliers")).toBeVisible();
  const added = card(page, NEW_SUPPLIER);
  await expect(added).toContainText("SUP-0009");
  await expect(added).toContainText("₱38,500.00 accepted");
  await expect(added).toContainText("Unpaid");
  await expect(added).toContainText(formatCalendarDate(DEPOSIT_DUE));
  await expect(added).toContainText("Upcoming");
});

test("8. search: accents, contact person and ID; never another event's supplier", async ({
  page,
}) => {
  await page.goto(suppliersPath());
  const search = page.getByRole("searchbox", { name: "Search suppliers" });

  await search.fill("pena");
  await search.press("Enter");
  await expect(page).toHaveURL(/q=pena/);
  await expect(shown(page, "1 of 9 suppliers match.")).toBeVisible();
  await expect(card(page, "Peña Florals")).toContainText("Liza Peña");
  await expect(page.getByRole("main")).not.toContainText("Gina Peña");

  await search.fill("dela cruz");
  await search.press("Enter");
  await expect(page).toHaveURL(/q=dela\+cruz/);
  await expect(shown(page, "1 of 9 suppliers match.")).toBeVisible();
  await expect(card(page, NEW_SUPPLIER)).toBeVisible();

  await search.fill("sup-0009");
  await search.press("Enter");
  await expect(page).toHaveURL(/q=sup-0009/);
  await expect(shown(page, "1 of 9 suppliers match.")).toBeVisible();
  await expect(card(page, NEW_SUPPLIER)).toContainText("SUP-0009");
  // The other event's supplier has the same name as the one just added: it is never found.
  await expect(page.getByRole("main")).not.toContainText("Outside Contact");

  await search.fill("fireworks wedding");
  await search.press("Enter");
  await expect(page).toHaveURL(/q=fireworks\+wedding/);
  await expect(page.getByRole("heading", { name: "No suppliers match" })).toBeVisible();
  await page.getByRole("link", { name: "Clear search and filters" }).first().click();
  await expect(page).toHaveURL(new RegExp(`${suppliersPath()}$`));
  await expect(shown(page, "9 suppliers")).toBeVisible();
});

test("9. filter: category, quote and payment status, overdue; combined with search", async ({
  page,
}) => {
  await page.goto(suppliersPath());
  await page.getByLabel("Category").selectOption("Flowers and styling");
  await page.getByLabel("Payment status").selectOption("No accepted quote");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(shown(page, "1 of 9 suppliers match.")).toBeVisible();
  await expect(card(page, "Peña Florals")).toBeVisible();
  await expect(page.getByRole("main")).not.toContainText("Gina Peña");

  // Overdue only: the sound supplier's deposit was due three days ago. Due today is not overdue,
  // and the other event's overdue suppliers never appear.
  await page.goto(`${suppliersPath()}?overdue=yes`);
  await expect(shown(page, "1 of 9 suppliers match.")).toBeVisible();
  await expect(card(page, "Lapu-Lapu Sound and Lights")).toContainText("Overdue");
  await expect(page.getByRole("checkbox", { name: /overdue payment/ })).toBeChecked();

  // Accepted quotes that are unpaid, among entertainment suppliers found by search.
  await page.goto(suppliersPath());
  await page.getByRole("searchbox", { name: "Search suppliers" }).fill("brass");
  await page.getByLabel("Quote").selectOption("Quote accepted");
  await page.getByLabel("Payment status").selectOption("Unpaid");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(shown(page, "1 of 9 suppliers match.")).toBeVisible();
  await expect(card(page, NEW_SUPPLIER)).toBeVisible();
  await page.getByLabel("Payment status").selectOption("Paid");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByRole("heading", { name: "No suppliers match" })).toBeVisible();
});

test("10. edit the supplier", async ({ page }) => {
  await page.goto(suppliersPath());
  await page.getByRole("link", { name: `Edit ${NEW_SUPPLIER} (SUP-0009)` }).click();
  await expect(page.getByLabel(/^Contact person/)).toHaveValue("Ramon Dela Cruz");
  await page.getByLabel(/^Name/).fill(EDITED_NAME);
  await page.getByLabel(/^Phone/).fill("0917 555 0110");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL(/\/suppliers\?saved=SUP-0009$/);
  await expect(card(page, EDITED_NAME)).toContainText("₱38,500.00 accepted");
  await page.goto(supplierPath);
  await expect(page.getByRole("region", { name: "Contact" })).toContainText("0917 555 0110");
});

test("11. Activity records the workflow, never contact details", async ({ page }) => {
  await page.goto(`${eventPath}/activity`);
  const feed = page.getByRole("main");
  await expect(feed).toContainText(`Added the supplier ${NEW_SUPPLIER} (SUP-0009): Entertainment`);
  await expect(feed).toContainText("Added the quote QUO-0009 for SUP-0009: ₱38,500.00 (Pending)");
  await expect(feed).toContainText("Accepted the quote QUO-0009 for SUP-0009");
  await expect(feed).toContainText(
    `Added the deposit PAY-0008 for SUP-0009: ₱11,550.00, due ${formatCalendarDate(DEPOSIT_DUE)}`,
  );
  await expect(feed).toContainText("Edited the supplier SUP-0009");
  await expect(feed).toContainText(`Name: “${NEW_SUPPLIER}” → “${EDITED_NAME}”`);
  await expect(feed).toContainText("Phone changed");
  for (const secret of ["0917 555 0109", "0917 555 0110", "bookings@bisayabrass.ph", "Ramon"]) {
    await expect(feed).not.toContainText(secret);
  }
});

test("12. another event's supplier can't be reached by its address", async ({ page }) => {
  // Through its own event, which the demo user doesn't belong to.
  await page.goto(`/events/${otherEventId}/suppliers/${lookAlikeId}`);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.getByRole("main")).not.toContainText("Gina Peña");
  // Through this event's address, swapping in its ID.
  for (const path of [
    `${suppliersPath()}/${lookAlikeId}`,
    `${suppliersPath()}/${lookAlikeId}/edit`,
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect(page.getByRole("main")).not.toContainText("Gina Peña");
  }
});

test("13. a Viewer sees suppliers, quotes and payments but can't open a form", async ({ page }) => {
  await addSecondOwner(eventId);
  await setDemoRole(eventId, "VIEWER");

  await page.goto(suppliersPath());
  await expect(card(page, EDITED_NAME)).toContainText("₱38,500.00 accepted");
  await expect(page.getByRole("link", { name: "Add supplier" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /^Edit / })).toHaveCount(0);

  await page.goto(supplierPath);
  await expect(page.getByRole("region", { name: "Deposits and payments" })).toContainText(
    "₱11,550.00",
  );
  await expect(page.getByRole("link", { name: /^(Add|Edit) / })).toHaveCount(0);

  for (const path of [
    `${suppliersPath()}/new`,
    `${supplierPath}/edit`,
    `${supplierPath}/quotes/new`,
    `${supplierPath}/payments/new`,
  ]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "You don't have access to this" }),
    ).toBeVisible();
  }
});