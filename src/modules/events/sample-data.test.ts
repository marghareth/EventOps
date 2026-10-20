// src/modules/events/sample-data.test.ts
// @vitest-environment node
// Dev-only sample data (D-041): the in-memory store must follow the same rules as the database code
// it stands in for: members only, role re-checks, stale saves refused, audit entries validated.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_USER } from "@/lib/demo-auth";
import { AUDIT_ACTIONS } from "@/modules/events/audit/public";

vi.mock("server-only", () => ({}));

const {
  SAMPLE_EVENT_IDS: IDS,
  resetSampleData,
  sampleCreateAttendee,
  sampleDeleteAttendee,
  sampleExportAttendees,
  sampleCreateEvent,
  sampleGetAttendee,
  sampleImportAttendees,
  sampleImportSuppliers,
  sampleListSuppliers,
  sampleUpdateAttendee,
  sampleDeleteEvent,
  sampleGetEventForMember,
  sampleListAttendees,
  sampleListAuditEntries,
  sampleListEvents,
  sampleUpdateEvent,
} = await import("./sample-data");
const { attendeeFormSchema, formatAttendeeReference } =
  await import("@/modules/events/attendees/public");

const ME = DEMO_USER.id;
const STRANGER = "7a1e2b3c-4d5e-4f60-8a9b-0c1d2e3f4a5b";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const details = (eventId: string) => {
  const event = sampleGetEventForMember(eventId, ME)!;
  const { name, venue, description, startsAt, endsAt, capacity, expectedAttendees } = event;
  return {
    version: event.updatedAt,
    details: { name, venue, description, startsAt, endsAt, capacity, expectedAttendees },
  };
};

beforeEach(() => resetSampleData());

describe("sample events", () => {
  it("lists only the demo user's events, with a role in each, soonest first", () => {
    const events = sampleListEvents(ME);
    expect(events.map((e) => [e.reference, e.role])).toEqual([
      ["EVT-2026-0005", "OWNER"],
      ["EVT-2026-0002", "COORDINATOR"],
      ["EVT-2026-0001", "OWNER"],
      ["EVT-2026-0004", "VIEWER"],
      ["EVT-2026-0003", "OWNER"],
    ]);
    expect(events.map((e) => e.id)).not.toContain(IDS.otherTeam);
  });

  it("lists only allowed fields", () => {
    expect(Object.keys(sampleListEvents(ME)[0]).sort()).toEqual(
      [
        "endsAt",
        "expectedAttendees",
        "id",
        "name",
        "reference",
        "role",
        "startsAt",
        "status",
        "venue",
      ].sort(),
    );
  });

  it("uses valid, fixed UUIDs, so the event pages accept them and links survive restarts", () => {
    for (const id of Object.values(IDS)) expect(id).toMatch(uuid);
  });

  it("covers all three roles for manual testing", () => {
    expect(new Set(sampleListEvents(ME).map((e) => e.role))).toEqual(
      new Set(["OWNER", "COORDINATOR", "VIEWER"]),
    );
  });

  it("shows a non-member nothing, exactly like an unknown event (D-027)", () => {
    expect(sampleGetEventForMember(IDS.otherTeam, ME)).toBeNull();
    expect(sampleGetEventForMember("5e000000-0000-4000-8000-0000000000ff", ME)).toBeNull();
    expect(sampleListEvents(STRANGER)).toEqual([]);
  });

  it("returns copies, so callers can't change the store by accident", () => {
    const event = sampleGetEventForMember(IDS.wedding, ME)!;
    event.name = "Changed";
    event.startsAt.setFullYear(1999);
    expect(sampleGetEventForMember(IDS.wedding, ME)!.name).toBe("Santos–Lim Wedding Reception");
    expect(sampleGetEventForMember(IDS.wedding, ME)!.startsAt.getUTCFullYear()).toBe(2026);
  });
});

describe("creating", () => {
  const now = new Date("2026-10-12T04:00:00Z");
  const event = {
    name: "Garcia Christening",
    venue: null,
    description: null,
    startsAt: new Date("2026-11-07T02:00:00Z"),
    endsAt: null,
    capacity: null,
    expectedAttendees: 40,
  };

  it("takes the next number, makes the creator Owner, and records event.created", () => {
    const created = sampleCreateEvent({ event, creatorId: ME, now });
    expect(created.reference).toBe("EVT-2026-0007");
    expect(sampleGetEventForMember(created.id, ME)).toMatchObject({
      name: "Garcia Christening",
      role: "OWNER",
      status: "DRAFT",
    });
    expect(sampleListAuditEntries(created.id)).toEqual([
      expect.objectContaining({
        action: "event.created",
        actorName: DEMO_USER.displayName,
        details: { reference: "EVT-2026-0007", name: "Garcia Christening" },
      }),
    ]);
  });
});

describe("editing (D-031, D-032)", () => {
  const now = new Date("2026-10-12T04:00:00Z");

  it("saves for an Owner or Coordinator and records only what changed", () => {
    for (const id of [IDS.wedding, IDS.summit]) {
      const { version, details: current } = details(id);
      const result = sampleUpdateEvent({
        eventId: id,
        editorId: ME,
        version,
        details: { ...current, expectedAttendees: 220 },
        now,
      });
      expect(result).toEqual({ ok: true });
      expect(sampleGetEventForMember(id, ME)!.expectedAttendees).toBe(220);
      expect(sampleListAuditEntries(id)[0]).toMatchObject({
        action: "event.updated",
        details: { changes: { expectedAttendees: { to: 220 } } },
      });
    }
  });

  it("refuses a Viewer and a non-member, changing nothing", () => {
    const { version, details: current } = details(IDS.yearEnd);
    const edit = { ...current, name: "Hacked" };
    expect(
      sampleUpdateEvent({ eventId: IDS.yearEnd, editorId: ME, version, details: edit }),
    ).toEqual({ ok: false, reason: "not-found" });
    expect(
      sampleUpdateEvent({ eventId: IDS.otherTeam, editorId: ME, version, details: edit }),
    ).toEqual({ ok: false, reason: "not-found" });
    expect(sampleGetEventForMember(IDS.yearEnd, ME)!.name).toBe("Makati Year-End Party");
  });

  it("refuses a stale save", () => {
    const { version, details: current } = details(IDS.wedding);
    sampleUpdateEvent({
      eventId: IDS.wedding,
      editorId: ME,
      version,
      details: { ...current, venue: "First" },
      now,
    });
    expect(
      sampleUpdateEvent({
        eventId: IDS.wedding,
        editorId: ME,
        version,
        details: { ...current, venue: "Second" },
        now,
      }),
    ).toEqual({ ok: false, reason: "stale" });
    expect(sampleGetEventForMember(IDS.wedding, ME)!.venue).toBe("First");
  });

  it("gives every save a new version, even within the same millisecond", () => {
    const first = details(IDS.wedding);
    const same = first.version;
    sampleUpdateEvent({
      eventId: IDS.wedding,
      editorId: ME,
      version: first.version,
      details: { ...first.details, venue: "A" },
      now: same,
    });
    const second = details(IDS.wedding);
    expect(second.version.getTime()).toBeGreaterThan(same.getTime());
    expect(
      sampleUpdateEvent({
        eventId: IDS.wedding,
        editorId: ME,
        version: second.version,
        details: { ...second.details, venue: "B" },
        now: same,
      }),
    ).toEqual({ ok: true });
  });

  it("records the description as changed, never its text (D-037)", () => {
    const { version, details: current } = details(IDS.wedding);
    sampleUpdateEvent({
      eventId: IDS.wedding,
      editorId: ME,
      version,
      details: { ...current, description: "Secret plans" },
      now,
    });
    const entry = sampleListAuditEntries(IDS.wedding)[0];
    expect(entry.details).toEqual({ changes: { description: { changed: true } } });
    expect(JSON.stringify(entry)).not.toContain("Secret plans");
  });
});

describe("deleting (D-033)", () => {
  it("lets only the Owner delete; the event and its activity go", () => {
    expect(sampleDeleteEvent({ eventId: IDS.summit, userId: ME })).toEqual({ ok: false });
    expect(sampleDeleteEvent({ eventId: IDS.yearEnd, userId: ME })).toEqual({ ok: false });
    expect(sampleDeleteEvent({ eventId: IDS.otherTeam, userId: ME })).toEqual({ ok: false });
    expect(sampleDeleteEvent({ eventId: IDS.wedding, userId: ME })).toEqual({ ok: true });
    expect(sampleGetEventForMember(IDS.wedding, ME)).toBeNull();
    expect(sampleListAuditEntries(IDS.wedding)).toEqual([]);
    expect(sampleListEvents(ME)).toHaveLength(4);
  });
});

describe("activity", () => {
  it("is newest first, names the actor and passes the audit registry's schemas", () => {
    const entries = sampleListAuditEntries(IDS.wedding);
    expect(entries.map((e) => e.action)).toEqual([
      "event.updated",
      "event.updated",
      "event.created",
    ]);
    const times = entries.map((e) => e.createdAt.getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect(entries.every((e) => e.actorName)).toBe(true);
  });

  it("seeds only entries the audit registry accepts", () => {
    for (const id of Object.values(IDS)) {
      for (const entry of sampleListAuditEntries(id)) {
        expect(entry.action).not.toBeNull();
        expect(AUDIT_ACTIONS[entry.action!].details.safeParse(entry.details).success).toBe(true);
      }
    }
  });

  it("names other members in events the demo user doesn't own", () => {
    expect(sampleListAuditEntries(IDS.summit)[0].actorName).toBe("Mika Santos");
  });
});

describe("reset", () => {
  it("goes back to the seeded samples", () => {
    sampleDeleteEvent({ eventId: IDS.wedding, userId: ME });
    resetSampleData();
    expect(sampleListEvents(ME)).toHaveLength(5);
  });
});

describe("sample attendees (B2-02)", () => {
  const now = new Date("2026-10-12T04:00:00Z");
  const guest = {
    name: "Rosa Aquino",
    email: null,
    phone: null,
    category: "Friends",
    rsvpStatus: "PENDING" as const,
    plusOnes: 1,
    dietaryNeeds: null,
    notes: null,
  };

  it("gives the Owner, Coordinator and Viewer events guests, and leaves one event empty", () => {
    expect(sampleListAttendees(IDS.wedding)).toHaveLength(8);
    expect(sampleListAttendees(IDS.summit)).toHaveLength(4);
    expect(sampleListAttendees(IDS.yearEnd)).toHaveLength(3);
    expect(sampleListAttendees(IDS.reunion)).toEqual([]);
  });

  it("seeds only guests the attendee validation accepts, with unique valid IDs", () => {
    const all = Object.values(IDS).flatMap((id) => sampleListAttendees(id));
    for (const a of all) {
      expect(a.id).toMatch(/^[0-9a-f-]{36}$/);
      const form = {
        name: a.name,
        email: a.email ?? "",
        phone: a.phone ?? "",
        category: a.category ?? "",
        rsvpStatus: a.rsvpStatus,
        plusOnes: String(a.plusOnes),
        dietaryNeeds: a.dietaryNeeds ?? "",
        notes: a.notes ?? "",
      };
      expect(attendeeFormSchema.safeParse(form).success).toBe(true);
    }
    expect(new Set(all.map((a) => a.id)).size).toBe(all.length);
  });

  it("lists by name and returns copies", () => {
    const list = sampleListAttendees(IDS.wedding);
    expect(list.map((a) => a.name)).toEqual([...list.map((a) => a.name)].sort());
    list[0].name = "Changed";
    expect(sampleListAttendees(IDS.wedding)[0].name).not.toBe("Changed");
  });

  it("adds for an Owner or Coordinator with the next number and an attendee.created entry", () => {
    const owner = sampleCreateAttendee({
      eventId: IDS.wedding,
      creatorId: ME,
      attendee: guest,
      now,
    });
    expect(owner).toEqual({
      ok: true,
      attendee: { id: expect.any(String), reference: "ATT-0009" },
    });
    const coordinator = sampleCreateAttendee({
      eventId: IDS.summit,
      creatorId: ME,
      attendee: guest,
      now,
    });
    expect(coordinator).toMatchObject({ ok: true, attendee: { reference: "ATT-0005" } });
    expect(sampleListAttendees(IDS.wedding).map((a) => a.name)).toContain("Rosa Aquino");
    expect(sampleListAuditEntries(IDS.wedding)[0]).toMatchObject({
      action: "attendee.created",
      details: { reference: "ATT-0009", name: "Rosa Aquino" },
    });
  });

  it("formats IDs exactly like the attendees context", () => {
    const result = sampleCreateAttendee({
      eventId: IDS.reunion,
      creatorId: ME,
      attendee: guest,
      now,
    });
    expect(result).toMatchObject({ attendee: { reference: formatAttendeeReference(1) } });
  });

  it("refuses a Viewer, a non-member and an unknown event, adding nothing", () => {
    for (const eventId of [IDS.yearEnd, IDS.otherTeam, "5e000000-0000-4000-8000-0000000000ff"]) {
      expect(sampleCreateAttendee({ eventId, creatorId: ME, attendee: guest, now })).toEqual({
        ok: false,
      });
    }
    expect(sampleListAttendees(IDS.yearEnd)).toHaveLength(3);
  });

  it("removes an event's guests with the event", () => {
    sampleDeleteEvent({ eventId: IDS.wedding, userId: ME });
    expect(sampleListAttendees(IDS.wedding)).toEqual([]);
  });
});

describe("editing sample attendees (B2-03)", () => {
  const now = new Date("2026-10-12T05:00:00Z");
  const first = () => sampleListAttendees(IDS.wedding)[0];
  const edit = (overrides: Partial<Parameters<typeof sampleUpdateAttendee>[0]> = {}) => {
    const a = first();
    const { id, number: _n, updatedAt, ...details } = a;
    void _n;
    return sampleUpdateAttendee({
      eventId: IDS.wedding,
      attendeeId: id,
      editorId: ME,
      version: updatedAt,
      details: { ...details, rsvpStatus: "DECLINED" },
      changes: { rsvpStatus: { from: a.rsvpStatus, to: "DECLINED" } },
      now,
      ...overrides,
    });
  };

  it("finds an attendee only in its own event", () => {
    const a = first();
    expect(sampleGetAttendee(IDS.wedding, a.id)).toMatchObject({ name: a.name });
    expect(sampleGetAttendee(IDS.summit, a.id)).toBeNull();
  });

  it("saves for the Owner, moves the version and records attendee.updated", () => {
    const before = first();
    expect(edit()).toEqual({ ok: true });
    const after = sampleGetAttendee(IDS.wedding, before.id)!;
    expect(after.rsvpStatus).toBe("DECLINED");
    expect(after.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
    expect(sampleListAuditEntries(IDS.wedding)[0]).toMatchObject({
      action: "attendee.updated",
      details: { reference: "ATT-0001", changes: { rsvpStatus: { to: "DECLINED" } } },
    });
  });

  it("refuses a stale save", () => {
    const version = first().updatedAt;
    expect(edit()).toEqual({ ok: true });
    expect(edit({ version })).toEqual({ ok: false, reason: "stale" });
  });

  it("refuses a Viewer, a non-member and another event's attendee", () => {
    const viewerGuest = sampleListAttendees(IDS.yearEnd)[0];
    const { id, number: _n, updatedAt, ...details } = viewerGuest;
    void _n;
    const base = { editorId: ME, version: updatedAt, details, changes: {}, now };
    expect(sampleUpdateAttendee({ ...base, eventId: IDS.yearEnd, attendeeId: id })).toEqual({
      ok: false,
      reason: "not-found",
    });
    expect(edit({ eventId: IDS.summit })).toEqual({ ok: false, reason: "not-found" });
    expect(edit({ editorId: "5e000000-0000-4000-8000-0000000000ff" })).toEqual({
      ok: false,
      reason: "not-found",
    });
  });

  it("refuses audit changes the registry doesn't allow (no personal values)", () => {
    expect(() => edit({ changes: { notes: { from: "a", to: "b" } } })).toThrow();
  });
});

describe("removing sample attendees (B2-04)", () => {
  const now = new Date("2026-10-12T06:00:00Z");
  const guest = {
    name: "Tess Lim",
    email: null,
    phone: null,
    category: null,
    rsvpStatus: "PENDING" as const,
    plusOnes: 0,
    dietaryNeeds: null,
    notes: null,
  };

  it("lets the Owner or Coordinator remove a guest; it is gone and Activity keeps who it was", () => {
    const [first] = sampleListAttendees(IDS.wedding);
    expect(
      sampleDeleteAttendee({ eventId: IDS.wedding, attendeeId: first.id, userId: ME, now }),
    ).toEqual({ ok: true, reference: "ATT-0001" });
    expect(sampleGetAttendee(IDS.wedding, first.id)).toBeNull();
    expect(sampleListAttendees(IDS.wedding)).toHaveLength(7);
    expect(sampleListAuditEntries(IDS.wedding)[0]).toMatchObject({
      action: "attendee.deleted",
      details: { reference: "ATT-0001", name: first.name },
    });
    const [summitGuest] = sampleListAttendees(IDS.summit);
    expect(
      sampleDeleteAttendee({ eventId: IDS.summit, attendeeId: summitGuest.id, userId: ME, now }),
    ).toMatchObject({ ok: true });
  });

  it("refuses a Viewer, another event's attendee and a second removal", () => {
    const [viewerGuest] = sampleListAttendees(IDS.yearEnd);
    expect(
      sampleDeleteAttendee({ eventId: IDS.yearEnd, attendeeId: viewerGuest.id, userId: ME, now }),
    ).toEqual({ ok: false });
    const [summitGuest] = sampleListAttendees(IDS.summit);
    expect(
      sampleDeleteAttendee({ eventId: IDS.wedding, attendeeId: summitGuest.id, userId: ME, now }),
    ).toEqual({ ok: false });
    const [first] = sampleListAttendees(IDS.wedding);
    sampleDeleteAttendee({ eventId: IDS.wedding, attendeeId: first.id, userId: ME, now });
    expect(
      sampleDeleteAttendee({ eventId: IDS.wedding, attendeeId: first.id, userId: ME, now }),
    ).toEqual({ ok: false });
    expect(sampleListAttendees(IDS.yearEnd)).toHaveLength(3);
    expect(sampleListAttendees(IDS.summit)).toHaveLength(4);
  });

  it("never gives a removed attendee's number to a new one", () => {
    const last = sampleListAttendees(IDS.wedding).find((a) => a.number === 8)!;
    sampleDeleteAttendee({ eventId: IDS.wedding, attendeeId: last.id, userId: ME, now });
    expect(
      sampleCreateAttendee({ eventId: IDS.wedding, creatorId: ME, attendee: guest, now }),
    ).toMatchObject({ ok: true, attendee: { reference: "ATT-0009" } });
  });
});

describe("sample import (B2-18, D-052)", () => {
  const at = new Date("2026-10-13T00:00:00Z");
  const person = (name: string) => ({
    name,
    email: null,
    phone: null,
    category: null,
    rsvpStatus: "PENDING" as const,
    plusOnes: 0,
    dietaryNeeds: null,
    notes: null,
  });

  it("adds every attendee with the next numbers and one attendees.imported entry", () => {
    expect(
      sampleImportAttendees({
        eventId: IDS.wedding,
        importerId: ME,
        attendees: [person("A"), person("B")],
        skipped: 3,
        now: at,
      }),
    ).toEqual({ ok: true, count: 2, first: "ATT-0009", last: "ATT-0010" });
    expect(
      sampleListAttendees(IDS.wedding)
        .filter((a) => ["A", "B"].includes(a.name))
        .map((a) => a.number),
    ).toEqual([9, 10]);
    expect(sampleListAuditEntries(IDS.wedding)[0]).toMatchObject({
      action: "attendees.imported",
      details: { count: 2, first: "ATT-0009", last: "ATT-0010", skipped: 3 },
    });
  });

  it("imports suppliers after the last number with one entry, and refuses a Viewer (B9, D-109)", () => {
    const supplier = (name: string) => ({
      name,
      category: "CATERING" as const,
      categoryDetail: null,
      contactName: null,
      email: null,
      phone: null,
      notes: null,
    });
    const args = {
      importerId: ME,
      suppliers: [supplier("Garden Kitchen"), supplier("Bloom Co.")],
      skipped: 1,
      fileType: "xlsx" as const,
      aiSuggested: true,
      now: at,
    };
    expect(sampleImportSuppliers({ ...args, eventId: IDS.wedding })).toEqual({
      ok: true,
      count: 2,
      first: "SUP-0005",
      last: "SUP-0006",
    });
    expect(sampleListSuppliers(IDS.wedding).filter((x) => x.number > 4)).toHaveLength(2);
    expect(sampleListAuditEntries(IDS.wedding)[0]).toMatchObject({
      action: "suppliers.imported",
      details: { count: 2, skipped: 1, fileType: "xlsx", aiSuggested: true },
    });
    const before = sampleListSuppliers(IDS.yearEnd).length;
    expect(sampleImportSuppliers({ ...args, eventId: IDS.yearEnd })).toEqual({ ok: false });
    expect(sampleListSuppliers(IDS.yearEnd)).toHaveLength(before);
  });

  it("refuses a Viewer, a stranger and an empty import, changing nothing", () => {
    const before = sampleListAttendees(IDS.yearEnd).length;
    expect(
      sampleImportAttendees({
        eventId: IDS.yearEnd,
        importerId: ME,
        attendees: [person("A")],
        skipped: 0,
        now: at,
      }),
    ).toEqual({ ok: false });
    expect(
      sampleImportAttendees({
        eventId: IDS.wedding,
        importerId: STRANGER,
        attendees: [person("A")],
        skipped: 0,
        now: at,
      }),
    ).toEqual({ ok: false });
    expect(
      sampleImportAttendees({
        eventId: IDS.wedding,
        importerId: ME,
        attendees: [],
        skipped: 0,
        now: at,
      }),
    ).toEqual({ ok: false });
    expect(sampleListAttendees(IDS.yearEnd)).toHaveLength(before);
  });
});

describe("sample export (B2-19, D-053)", () => {
  const at = new Date("2026-10-13T00:00:00Z");

  it("returns the event's attendees in ID order and records attendees.exported", () => {
    const rows = sampleExportAttendees({ eventId: IDS.wedding, userId: ME, now: at });
    expect(rows?.map((a) => a.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(sampleListAuditEntries(IDS.wedding)[0]).toMatchObject({
      action: "attendees.exported",
      details: { count: 8 },
    });
  });

  it("refuses a Viewer and a stranger, recording nothing", () => {
    const before = sampleListAuditEntries(IDS.yearEnd).length;
    expect(sampleExportAttendees({ eventId: IDS.yearEnd, userId: ME, now: at })).toBeNull();
    expect(sampleExportAttendees({ eventId: IDS.wedding, userId: STRANGER, now: at })).toBeNull();
    expect(sampleListAuditEntries(IDS.yearEnd)).toHaveLength(before);
  });
});