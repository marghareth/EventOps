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
  sampleCreateEvent,
  sampleDeleteEvent,
  sampleGetEventForMember,
  sampleListAuditEntries,
  sampleListEvents,
  sampleUpdateEvent,
} = await import("./sample-data");

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