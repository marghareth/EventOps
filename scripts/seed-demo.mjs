// scripts/seed-demo.mjs
// Dev-only mock data: one complete demo event for the dev demo user (D-024), so every screen has
// something to show with `npm run dev`. Run after `npm run db:deploy`:
//
//   npm run db:seed:demo
//
// What it creates (dates are worked out from today in Manila, so the event always looks current):
//   - "Santos–Reyes Wedding" in 53 days, capacity 200, 180 expected, status Planning.
//     Demo Coordinator is Owner; two extra local users are Coordinator and Viewer.
//   - 24 guests (every RSVP state, plus-ones, categories, dietary needs, a few without contacts).
//   - Accessibility needs and resources with real gaps (Not ready): too few accessible seats,
//     captioning not available, sign language not set up.
//   - 8 suppliers with accepted, pending and declined quotes and deposits/payments that are paid,
//     overdue, due today and upcoming; one supplier without contact details.
//   - A budget with 6 categories; Catering is over its allocation.
//   - 12 tasks across statuses and priorities, some overdue, one High task unassigned.
//   - Impact assumptions (₱1,200 per head, 2 accessible seats per 100 guests) so the Impact page
//     can be tried with 180 → 220.
//   - A few Activity entries.
//
// Safe to run again: it replaces the previous demo event (and everything in it) and keeps its
// EVT number. Refuses to run unless DATABASE_URL points at this machine, so it can never touch
// Supabase.
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local", quiet: true });

const out = (line) => process.stdout.write(`${line}\n`);
const fail = (line) => process.stderr.write(`${line}\n`);

/** The fixed dev demo user (src/lib/demo-auth.ts). */
const DEMO_USER = {
  id: "00000000-0000-4000-8000-00000000d3e0",
  email: "demo@eventops.local",
  displayName: "Demo Coordinator",
};
const COORDINATOR = {
  id: "00000000-0000-4000-8000-00000000c001",
  email: "maria.cruz@eventops.local",
  displayName: "Maria Cruz",
};
const VIEWER = {
  id: "00000000-0000-4000-8000-00000000c002",
  email: "paolo.lim@eventops.local",
  displayName: "Paolo Lim",
};
/** Fixed so a second run replaces the event instead of adding another one. */
const EVENT_ID = "e7e00000-0000-4000-8000-000000000001";

// ── Safety ────────────────────────────────────────────────────────────────────────────────────
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  fail("DATABASE_URL is not set in .env.local. See docs/contributing.md.");
  process.exit(1);
}
const host = new URL(connectionString).hostname;
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) {
  fail(`Refusing to seed "${host}": demo data only goes into a database on this machine.`);
  process.exit(1);
}

// ── Dates (Philippine calendar days; stored as UTC like the app does) ─────────────────────────
const todayManila = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(
  new Date(),
);
/** "YYYY-MM-DD", `n` days from today in Manila. */
function day(n) {
  const d = new Date(`${todayManila}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** A Manila local time on day `n`, as a UTC timestamp string for a `timestamp` column. */
function manilaTime(n, hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(`${day(n)}T00:00:00Z`);
  d.setUTCHours(h - 8, m); // Manila is UTC+8 all year.
  return d.toISOString().replace("T", " ").replace("Z", "");
}
const EVENT_DAY = 53;

// ── Data ──────────────────────────────────────────────────────────────────────────────────────
// [name, email, phone, category, rsvp, plusOnes, dietary, notes]
// prettier-ignore
const GUESTS = [
  ["Lola Carmen Santos", "carmen.santos@example.com", "+63 917 555 0101", "Family", "CONFIRMED", 0, "Low sodium", "Grandmother of the bride. Seat near the front."],
  ["Roberto Santos", "roberto.santos@example.com", "+63 917 555 0102", "Family", "CONFIRMED", 1, null, null],
  ["Elena Santos", "elena.santos@example.com", "+63 917 555 0103", "Family", "CONFIRMED", 1, "Vegetarian", null],
  ["Miguel Reyes", "miguel.reyes@example.com", "+63 918 555 0104", "Family", "CONFIRMED", 2, null, null],
  ["Teresa Reyes", "teresa.reyes@example.com", "+63 918 555 0105", "Family", "CONFIRMED", 0, "No pork", null],
  ["Jose Reyes", null, "+63 918 555 0106", "Family", "MAYBE", 1, null, "Flying in from Davao; confirming flights."],
  ["Andrea Lim", "andrea.lim@example.com", "+63 919 555 0107", "Friends", "CONFIRMED", 1, "Gluten free", null],
  ["Carlo Mendoza", "carlo.mendoza@example.com", null, "Friends", "CONFIRMED", 0, null, null],
  ["Bea Villanueva", "bea.v@example.com", "+63 919 555 0109", "Friends", "PENDING", 1, null, null],
  ["Paolo Garcia", "paolo.garcia@example.com", "+63 920 555 0110", "Friends", "CONFIRMED", 1, "Nut allergy (severe)", "Carries an EpiPen; tell catering."],
  ["Kristine Tan", "kristine.tan@example.com", "+63 920 555 0111", "Friends", "DECLINED", 0, null, null],
  ["Mark Dela Cruz", null, null, "Friends", "PENDING", 0, null, null],
  ["Sofia Ramos", "sofia.ramos@example.com", "+63 921 555 0113", "Friends", "CONFIRMED", 0, "Vegan", null],
  ["Luis Fernandez", "luis.fernandez@example.com", "+63 921 555 0114", "Colleagues", "CONFIRMED", 1, null, null],
  ["Grace Aquino", "grace.aquino@example.com", "+63 922 555 0115", "Colleagues", "CONFIRMED", 0, "Halal", null],
  ["Ramon Bautista", "ramon.b@example.com", "+63 922 555 0116", "Colleagues", "MAYBE", 1, null, null],
  ["Patricia Navarro", "patricia.navarro@example.com", "+63 923 555 0117", "Colleagues", "PENDING", 0, null, null],
  ["Daniel Uy", "daniel.uy@example.com", "+63 923 555 0118", "Colleagues", "DECLINED", 1, null, null],
  ["Isabel Cruz", "isabel.cruz@example.com", "+63 924 555 0119", "Ninong/Ninang", "CONFIRMED", 1, null, "Principal sponsor."],
  ["Antonio Gonzales", "antonio.g@example.com", "+63 924 555 0120", "Ninong/Ninang", "CONFIRMED", 1, "Diabetic: no sugary desserts", "Principal sponsor."],
  ["Rosario Castillo", "rosario.castillo@example.com", "+63 925 555 0121", "Ninong/Ninang", "CONFIRMED", 0, null, null],
  ["Ben Torres", null, "+63 925 555 0122", "Friends", "CONFIRMED", 0, null, "Deaf; communicates in Filipino Sign Language."],
  ["Nina Salazar", "nina.salazar@example.com", null, "Friends", "PENDING", 2, null, null],
  ["Victor Morales", "victor.morales@example.com", "+63 926 555 0124", "Colleagues", "CONFIRMED", 0, null, null],
];

// [guest index, type, priority, note]
// prettier-ignore
const NEEDS = [
  [0, "MOBILITY_ASSISTANCE", "REQUIRED", "Uses a wheelchair; needs help from the car."],
  [0, "ACCESSIBLE_SEATING", "REQUIRED", null],
  [0, "STEP_FREE_ENTRANCE", "REQUIRED", null],
  [0, "ACCESSIBLE_RESTROOM", "REQUIRED", null],
  [4, "ACCESSIBLE_SEATING", "REQUIRED", "Recovering from knee surgery."],
  [19, "ACCESSIBLE_SEATING", "REQUIRED", null],
  [21, "SIGN_LANGUAGE", "REQUIRED", "Filipino Sign Language interpreter for the ceremony and speeches."],
  [21, "CAPTIONING", "PREFERRED", "Captions on the reception screen."],
  [13, "CAPTIONING", "PREFERRED", null],
  [9, "OTHER", "INFORMATIONAL", "Severe nut allergy: seat away from the dessert table."],
];

// [type, status, quantity, note]
// prettier-ignore
const RESOURCES = [
  ["ACCESSIBLE_SEATS", "AVAILABLE", 2, "Two reserved spots at table 1 with chairs removed."],
  ["ACCESSIBLE_ENTRANCE", "AVAILABLE", null, "Side entrance from the lobby is level."],
  ["RAMP_OR_ELEVATOR", "ARRANGING", null, "Venue to confirm the ramp to the garden ceremony area."],
  ["ACCESSIBLE_RESTROOM", "AVAILABLE", null, null],
  ["CAPTIONING", "NOT_AVAILABLE", null, "Sound supplier has no captioning service."],
];

// quotes: [amount, status, description]
// payments: [kind, amount, due (days from today), paid (days from today) or null, description]
// prettier-ignore
const SUPPLIERS = [
  {
    name: "Shangri-La Mactan Grand Ballroom", category: "VENUE", contactName: "Jenny Ong",
    email: "events@venue.example.com", phone: "+63 32 555 0201", notes: "Includes tables, chairs and basic lights.",
    quotes: [["180000.00", "ACCEPTED", "Ballroom and garden, 6 hours"]],
    payments: [["DEPOSIT", "54000.00", -40, -41, "30% reservation"], ["PAYMENT", "126000.00", EVENT_DAY - 14, null, "Balance"]],
  },
  {
    name: "Casa Verde Catering", category: "CATERING", contactName: "Chef Ramon Lao",
    email: "bookings@casaverde.example.com", phone: "+63 917 555 0202", notes: "Final headcount due 2 weeks before.",
    quotes: [["216000.00", "ACCEPTED", "Plated dinner, 180 guests at ₱1,200"], ["198000.00", "DECLINED", "Buffet option"]],
    payments: [["DEPOSIT", "64800.00", -30, -29, "30% deposit"], ["PAYMENT", "75600.00", -5, null, "Second payment"], ["PAYMENT", "75600.00", EVENT_DAY - 7, null, "Final payment"]],
  },
  {
    name: "Lumière Photo & Films", category: "PHOTO_AND_VIDEO", contactName: "Aya Santiago",
    email: "hello@lumiere.example.com", phone: "+63 918 555 0203", notes: null,
    quotes: [["85000.00", "ACCEPTED", "Photo and same-day edit video"]],
    payments: [["DEPOSIT", "25000.00", 0, null, "Booking fee"]],
  },
  {
    name: "Petal & Pine Florals", category: "FLOWERS_AND_STYLING", contactName: "Mae Robles",
    email: "mae@petalpine.example.com", phone: null, notes: "Waiting on revised quote with local blooms.",
    quotes: [["65000.00", "PENDING", "Full styling, imported roses"], ["48000.00", "PENDING", "Local blooms option"]],
    payments: [],
  },
  {
    name: "SoundWave Events", category: "SOUND_AND_LIGHTS", contactName: "Jun Pascual",
    email: "jun@soundwave.example.com", phone: "+63 919 555 0205", notes: null,
    quotes: [["55000.00", "DECLINED", "Full band setup"], ["38000.00", "PENDING", "DJ and lights"]],
    payments: [],
  },
  {
    name: "Sugarbloom Cakes", category: "CAKE_AND_DESSERTS", contactName: "Lia Chua",
    email: "orders@sugarbloom.example.com", phone: "+63 920 555 0206", notes: "Three tiers, one nut-free.",
    quotes: [["22000.00", "ACCEPTED", "3-tier cake and dessert table"]],
    payments: [["PAYMENT", "22000.00", -10, -12, "Paid in full"]],
  },
  {
    name: "Island Shuttle Co.", category: "TRANSPORT", contactName: null,
    email: null, phone: null, notes: "Got their name from the venue; no contact yet.",
    quotes: [],
    payments: [],
  },
  {
    name: "Starlight Pyrotechnics", category: "OTHER", categoryDetail: "Fireworks", contactName: "Rey Abad",
    email: "rey@starlight.example.com", phone: "+63 921 555 0208", notes: "Needs venue permit.",
    quotes: [["30000.00", "PENDING", "3-minute display"]],
    payments: [],
  },
];

// [category, allocation, items: [name, estimated, committed, paid, notes]]
// prettier-ignore
const BUDGET = [
  ["Venue", "190000.00", [["Ballroom and garden", "180000.00", "180000.00", "54000.00", null]]],
  ["Catering", "200000.00", [
    ["Plated dinner", "216000.00", "216000.00", "64800.00", "180 guests at ₱1,200."],
    ["Drinks package", "12000.00", "0.00", "0.00", null],
  ]],
  ["Photo and video", "90000.00", [["Photo and same-day edit", "85000.00", "85000.00", "0.00", null]]],
  ["Flowers and styling", "60000.00", [["Ceremony and reception styling", "55000.00", "0.00", "0.00", "Two quotes pending."]]],
  ["Entertainment", "45000.00", [["DJ and lights", "38000.00", "0.00", "0.00", null], ["Fireworks", "30000.00", "0.00", "0.00", null]]],
  ["Cake and desserts", "25000.00", [["Wedding cake", "22000.00", "22000.00", "22000.00", null]]],
];

// [title, description, priority, status, due (days from today) or null, assignee]
// prettier-ignore
const TASKS = [
  ["Send final headcount to catering", "Casa Verde needs the confirmed guest count two weeks before.", "HIGH", "NOT_STARTED", EVENT_DAY - 14, "coordinator"],
  ["Book sign language interpreter", "For Ben Torres: ceremony and speeches.", "HIGH", "NOT_STARTED", -3, null],
  ["Confirm ramp to garden ceremony area", "Venue is checking; we need a yes or an alternative.", "HIGH", "IN_PROGRESS", -1, "owner"],
  ["Pay catering second payment", "₱75,600 was due; check with the couple.", "HIGH", "NOT_STARTED", -5, "owner"],
  ["Finalize seating plan", "Include accessible seats near the front for three guests.", "MEDIUM", "IN_PROGRESS", 20, "coordinator"],
  ["Chase pending RSVPs", "Four guests haven't replied.", "MEDIUM", "IN_PROGRESS", 7, "coordinator"],
  ["Choose florist option", "Imported roses vs local blooms.", "MEDIUM", "NOT_STARTED", 10, "owner"],
  ["Get shuttle supplier contact", null, "MEDIUM", "NOT_STARTED", 14, null],
  ["Fireworks venue permit", "Starlight needs the permit before they confirm.", "LOW", "NOT_STARTED", 25, null],
  ["Order souvenirs", null, "LOW", "NOT_STARTED", null, null],
  ["Sign venue contract", null, "HIGH", "DONE", -42, "owner"],
  ["Pay photographer booking fee", "₱25,000 due today.", "MEDIUM", "NOT_STARTED", 0, "owner"],
];

// ── Seed ──────────────────────────────────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(4, "0");
const client = new pg.Client({ connectionString });
await client.connect();

async function insert(table, row) {
  const cols = Object.keys(row);
  const sql = `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(", ")})
    VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING id`;
  const { rows } = await client.query(sql, Object.values(row));
  return rows[0]?.id;
}
async function newId() {
  return (await client.query("SELECT gen_random_uuid() AS id")).rows[0].id;
}
async function audit(action, details, minutesAgo) {
  await client.query(
    `INSERT INTO audit_logs (id, "eventId", "actorId", action, details, "createdAt")
     VALUES (gen_random_uuid(), $1, $2, $3, $4, now() - make_interval(mins => $5))`,
    [EVENT_ID, DEMO_USER.id, action, details, minutesAgo],
  );
}

try {
  await client.query("BEGIN");
  await client.query("SET LOCAL TIME ZONE 'UTC'");

  // Replace the previous demo event (cascade removes everything in it, D-004), keeping its number.
  const { rows: previous } = await client.query(
    "DELETE FROM events WHERE id = $1 RETURNING reference",
    [EVENT_ID],
  );

  for (const user of [DEMO_USER, COORDINATOR, VIEWER]) {
    await client.query(
      `INSERT INTO users (id, email, "displayName") VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
      [user.id, user.email, user.displayName],
    );
  }

  // Event reference: the previous run's, or the next from the per-year counter like
  // create-event.ts (D-005).
  let reference = previous[0]?.reference;
  if (!reference) {
    const year = Number(todayManila.slice(0, 4));
    const { rows: counter } = await client.query(
      `INSERT INTO event_reference_counters (year, "lastNumber", "updatedAt") VALUES ($1, 1, now())
       ON CONFLICT (year) DO UPDATE SET "lastNumber" = event_reference_counters."lastNumber" + 1,
         "updatedAt" = now()
       RETURNING "lastNumber"`,
      [year],
    );
    reference = `EVT-${year}-${pad(counter[0].lastNumber)}`;
  }
  const eventName = "Santos–Reyes Wedding";

  await insert("events", {
    id: EVENT_ID,
    reference,
    name: eventName,
    description:
      "Church ceremony at 3 PM, garden photos, then dinner reception in the Grand Ballroom. " +
      "Demo data created by scripts/seed-demo.mjs.",
    venue: "Shangri-La Mactan, Lapu-Lapu City, Cebu",
    startsAt: manilaTime(EVENT_DAY, "15:00"),
    endsAt: manilaTime(EVENT_DAY, "23:00"),
    capacity: 200,
    expectedAttendees: 180,
    status: "PLANNING",
    createdById: DEMO_USER.id,
    createdAt: manilaTime(-45, "10:00"),
    updatedAt: manilaTime(-1, "09:00"),
  });

  const memberIds = {};
  for (const [key, user, role] of [
    ["owner", DEMO_USER, "OWNER"],
    ["coordinator", COORDINATOR, "COORDINATOR"],
    ["viewer", VIEWER, "VIEWER"],
  ]) {
    memberIds[key] = await insert("event_members", {
      id: await newId(),
      eventId: EVENT_ID,
      userId: user.id,
      role,
    });
  }

  // Attendees
  const attendeeIds = [];
  for (const [i, guest] of GUESTS.entries()) {
    const [name, email, phone, category, rsvpStatus, plusOnes, dietaryNeeds, notes] = guest;
    attendeeIds.push(
      await insert("attendees", {
        id: await newId(),
        eventId: EVENT_ID,
        number: i + 1,
        name,
        email,
        phone,
        category,
        rsvpStatus,
        plusOnes,
        dietaryNeeds,
        notes,
        updatedAt: manilaTime(-20, "12:00"),
      }),
    );
  }

  // Accessibility
  for (const [guest, type, priority, note] of NEEDS) {
    await insert("accessibility_requirements", {
      id: await newId(),
      eventId: EVENT_ID,
      attendeeId: attendeeIds[guest],
      type,
      priority,
      note,
      updatedAt: manilaTime(-15, "12:00"),
    });
  }
  for (const [type, status, quantity, note] of RESOURCES) {
    await insert("accessibility_resources", {
      id: await newId(),
      eventId: EVENT_ID,
      type,
      status,
      quantity,
      note,
      updatedAt: manilaTime(-10, "12:00"),
    });
  }

  // Suppliers, quotes, payments
  let quoteNo = 0;
  let paymentNo = 0;
  for (const [i, s] of SUPPLIERS.entries()) {
    const supplierId = await insert("suppliers", {
      id: await newId(),
      eventId: EVENT_ID,
      number: i + 1,
      name: s.name,
      category: s.category,
      categoryDetail: s.categoryDetail ?? null,
      contactName: s.contactName,
      email: s.email,
      phone: s.phone,
      notes: s.notes,
      updatedAt: manilaTime(-25, "12:00"),
    });
    for (const [amount, status, description] of s.quotes) {
      quoteNo += 1;
      await insert("supplier_quotes", {
        id: await newId(),
        eventId: EVENT_ID,
        supplierId,
        number: quoteNo,
        description,
        amount,
        status,
        statusChangedAt: manilaTime(-30, "12:00"),
        updatedAt: manilaTime(-30, "12:00"),
      });
    }
    for (const [kind, amount, dueDay, paidDay, description] of s.payments) {
      paymentNo += 1;
      await insert("supplier_payments", {
        id: await newId(),
        eventId: EVENT_ID,
        supplierId,
        number: paymentNo,
        kind,
        description,
        amount,
        dueDate: day(dueDay),
        status: paidDay === null ? "UNPAID" : "PAID",
        paidOn: paidDay === null ? null : day(paidDay),
        updatedAt: manilaTime(-5, "12:00"),
      });
    }
  }

  // Budget
  let itemNo = 0;
  let cateringCategoryId = null;
  for (const [name, allocationAmount, items] of BUDGET) {
    const categoryId = await insert("budget_categories", {
      id: await newId(),
      eventId: EVENT_ID,
      name,
      allocationAmount,
      updatedAt: manilaTime(-20, "12:00"),
    });
    if (name === "Catering") cateringCategoryId = categoryId;
    for (const [itemName, estimatedAmount, committedAmount, paidAmount, notes] of items) {
      itemNo += 1;
      await insert("budget_items", {
        id: await newId(),
        eventId: EVENT_ID,
        categoryId,
        number: itemNo,
        name: itemName,
        estimatedAmount,
        committedAmount,
        paidAmount,
        notes,
        updatedAt: manilaTime(-20, "12:00"),
      });
    }
  }

  // Tasks
  for (const [i, [title, description, priority, status, dueDay, assignee]] of TASKS.entries()) {
    await insert("tasks", {
      id: await newId(),
      eventId: EVENT_ID,
      number: i + 1,
      title,
      description,
      priority,
      status,
      dueDate: dueDay === null ? null : day(dueDay),
      assigneeId: assignee ? memberIds[assignee] : null,
      updatedAt: manilaTime(-3, "12:00"),
    });
  }

  // Impact assumptions (D-102)
  await client.query(
    `INSERT INTO event_impact_assumptions ("eventId", "cateringCostPerHead", "accessibleSeatsPer100",
       "cateringCategoryId", "updatedAt") VALUES ($1, $2, $3, $4, now())`,
    [EVENT_ID, "1200.00", "2.00", cateringCategoryId],
  );

  // Readable-number counters, so the app's next number follows the seeded ones.
  await client.query(
    `UPDATE events SET "lastAttendeeNumber" = $2, "lastSupplierNumber" = $3, "lastQuoteNumber" = $4,
       "lastPaymentNumber" = $5, "lastBudgetItemNumber" = $6, "lastTaskNumber" = $7 WHERE id = $1`,
    [EVENT_ID, GUESTS.length, SUPPLIERS.length, quoteNo, paymentNo, itemNo, TASKS.length],
  );

  // A few Activity entries, in the shapes the audit registry accepts (src/modules/events/audit).
  const days = (n) => n * 24 * 60;
  await audit("event.created", { reference, name: eventName }, days(45));
  await audit(
    "attendees.imported",
    {
      count: GUESTS.length,
      first: `ATT-${pad(1)}`,
      last: `ATT-${pad(GUESTS.length)}`,
      skipped: 0,
      fileType: "csv",
      aiSuggested: false,
    },
    days(20),
  );
  await audit(
    "suppliers.imported",
    {
      count: SUPPLIERS.length,
      first: `SUP-${pad(1)}`,
      last: `SUP-${pad(SUPPLIERS.length)}`,
      skipped: 0,
      fileType: "xlsx",
      aiSuggested: false,
    },
    days(19),
  );

  await client.query("COMMIT");
  out(`Seeded ${reference} "${eventName}".`);
  out(`Open http://localhost:3000/events/${EVENT_ID} (npm run dev with DEV_DEMO_AUTH=true).`);
} catch (error) {
  await client.query("ROLLBACK");
  fail("Seeding failed; nothing was saved.");
  fail(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exitCode = 1;
} finally {
  await client.end();
}
