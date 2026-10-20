// src/modules/events/impact/actions.test.ts
// @vitest-environment node
// Impact server actions (B7-F11, B7-F12, B7-F14; D-102, D-103) with authorization, storage and
// Next.js replaced. Each action asks for its own permission, and a refusal never reaches storage, so
// the action check holds even without the database's own check (impact.db.test.ts covers both).
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const authorizeEvent = vi.fn();
vi.mock("@/modules/events/public", () => ({
  authorizeEvent: (...args: unknown[]) => authorizeEvent(...args),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  },
}));

const repository = {
  getAssumptions: vi.fn(),
  saveAssumptions: vi.fn(),
  listAnalyses: vi.fn(),
  saveAnalysis: vi.fn(),
};
const reader = { read: vi.fn() };
vi.mock("./composition", () => ({
  impactRepository: () => repository,
  impactStateReader: () => reader,
}));

const { saveAnalysisAction, saveAssumptionsAction } = await import("./actions");

const EVENT = "e0000000-0000-4000-8000-00000000000a";
const USER = { id: "u1", email: "mika@example.test" };
const idle = { status: "idle" } as const;
const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};
const assumptions = form({
  cateringCostPerHead: "300",
  accessibleSeatsPer100: "",
  cateringCategoryId: "",
  version: "",
});
const analysis = form({ to: "220", from: "180", version: "" });

beforeEach(() => vi.clearAllMocks());

describe("saveAssumptionsAction", () => {
  it("asks for impact.assumptions, and stops at a refusal", async () => {
    authorizeEvent.mockResolvedValue({ ok: false, reason: "forbidden" });
    const state = await saveAssumptionsAction(EVENT, idle, assumptions);
    expect(authorizeEvent).toHaveBeenCalledWith(EVENT, "impact.assumptions", `/events/${EVENT}/impact`);
    expect(state).toMatchObject({
      status: "error",
      message: "Only Owners and Coordinators can change the assumptions.",
    });
    expect(repository.saveAssumptions).not.toHaveBeenCalled();
  });

  it("saves with the authorized event and user, never IDs from the form", async () => {
    authorizeEvent.mockResolvedValue({ ok: true, event: { id: EVENT }, user: USER });
    repository.saveAssumptions.mockResolvedValue({ ok: true, changed: true });
    await expect(
      saveAssumptionsAction(EVENT, idle, form({ ...Object.fromEntries(assumptions), eventId: "x" })),
    ).rejects.toMatchObject({ url: `/events/${EVENT}/impact?notice=assumptions-saved` });
    expect(repository.saveAssumptions).toHaveBeenCalledWith({
      eventId: EVENT,
      actorId: USER.id,
      version: null,
      input: { cateringCostPerHead: "300.00", accessibleSeatsPer100: null, cateringCategoryId: null },
    });
  });

  it("says nothing was saved when storage fails", async () => {
    authorizeEvent.mockResolvedValue({ ok: true, event: { id: EVENT }, user: USER });
    repository.saveAssumptions.mockRejectedValue(new Error("connection refused 10.0.0.5"));
    expect(await saveAssumptionsAction(EVENT, idle, assumptions)).toMatchObject({
      status: "error",
      message: "We couldn't save. Nothing was changed. Try again in a moment.",
    });
  });
});

describe("saveAnalysisAction", () => {
  it("asks for impact.record, and stops at a refusal before reading anything", async () => {
    authorizeEvent.mockResolvedValue({ ok: false, reason: "forbidden" });
    const state = await saveAnalysisAction(EVENT, idle, analysis);
    expect(authorizeEvent).toHaveBeenCalledWith(EVENT, "impact.record", `/events/${EVENT}/impact`);
    expect(state).toEqual({
      status: "error",
      message: "Only Owners and Coordinators can save analyses to the history.",
    });
    expect(reader.read).not.toHaveBeenCalled();
    expect(repository.saveAnalysis).not.toHaveBeenCalled();
  });

  it("treats an unknown event like a refusal", async () => {
    authorizeEvent.mockResolvedValue({ ok: false, reason: "not-found" });
    expect(await saveAnalysisAction(EVENT, idle, analysis)).toEqual({
      status: "error",
      message: "We couldn't find this event.",
    });
    expect(repository.saveAnalysis).not.toHaveBeenCalled();
  });

  it("says nothing was saved when the event's data can't be read", async () => {
    authorizeEvent.mockResolvedValue({
      ok: true,
      event: { id: EVENT, expectedAttendees: 180, capacity: 200 },
      user: USER,
    });
    reader.read.mockResolvedValue(null);
    repository.getAssumptions.mockResolvedValue({
      cateringCostPerHead: null,
      accessibleSeatsPer100: null,
      cateringCategoryId: null,
      cateringCategoryName: null,
      updatedAt: null,
    });
    expect(await saveAnalysisAction(EVENT, idle, analysis)).toEqual({
      status: "error",
      message: "We couldn't read all of this event's data, so nothing was saved. Try again.",
    });
    expect(repository.saveAnalysis).not.toHaveBeenCalled();
  });
});