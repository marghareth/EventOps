// src/modules/events/budget/queries.test.ts
// Event scoping of the budget reads (B5-F10; D-084, D-085, D-091). With the authorization and the
// repository replaced, this checks that every read uses the event ID that authorizeEvent returned,
// never the one the caller sent; refuses before touching storage; and treats a malformed or foreign
// record ID as "not found".
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const EVENT_A = "e0000000-0000-4000-8000-00000000000a";
const SENT = "E0000000-0000-4000-8000-00000000000A"; // same event, as the caller wrote it
const CAT_B = "c0000000-0000-4000-8000-00000000000b";
const ITEM_B = "10000000-0000-4000-8000-00000000000b";

const authorizeEvent = vi.fn();
vi.mock("@/modules/events/public", () => ({
  authorizeEvent: (...args: unknown[]) => authorizeEvent(...args),
}));

const repository = {
  listBudget: vi.fn(async () => []),
  findCategory: vi.fn(async () => null),
  findItem: vi.fn(async () => null),
};
vi.mock("./composition", () => ({ budgetRepository: () => repository }));

const { getCategoryForEdit, getEventBudget, getItemFormContext } = await import("./queries");

const allow = (permission: string) =>
  authorizeEvent.mockImplementation(async (_id: string, wanted: string) =>
    wanted === permission || permission === "all"
      ? { ok: true, event: { id: EVENT_A } }
      : { ok: false, reason: "forbidden" },
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getEventBudget", () => {
  it("reads only the event that authorization returned", async () => {
    allow("all");
    const result = await getEventBudget(SENT);
    expect(result).toMatchObject({ ok: true, canManage: true });
    expect(repository.listBudget).toHaveBeenCalledExactlyOnceWith(EVENT_A);
  });

  it("lets a viewer read but not manage", async () => {
    allow("event.view");
    expect(await getEventBudget(EVENT_A)).toMatchObject({ ok: true, canManage: false });
  });

  it("returns nothing, and never reads storage, for a non-member", async () => {
    authorizeEvent.mockResolvedValue({ ok: false, reason: "not-found" });
    expect(await getEventBudget(EVENT_A)).toEqual({ ok: false, reason: "not-found" });
    expect(repository.listBudget).not.toHaveBeenCalled();
  });
});

describe("getCategoryForEdit", () => {
  it("looks the category up inside the authorized event; another event's is not found", async () => {
    allow("budget.manage");
    expect(await getCategoryForEdit(SENT, CAT_B)).toEqual({ ok: false, reason: "not-found" });
    expect(repository.findCategory).toHaveBeenCalledExactlyOnceWith(EVENT_A, CAT_B);
  });

  it("refuses a viewer before touching storage", async () => {
    allow("event.view");
    expect(await getCategoryForEdit(EVENT_A, CAT_B)).toEqual({ ok: false, reason: "forbidden" });
    expect(repository.findCategory).not.toHaveBeenCalled();
  });

  it("treats a malformed ID as not found without a query", async () => {
    allow("budget.manage");
    expect(await getCategoryForEdit(EVENT_A, "not-a-uuid")).toEqual({
      ok: false,
      reason: "not-found",
    });
    expect(repository.findCategory).not.toHaveBeenCalled();
  });
});

describe("getItemFormContext", () => {
  it("looks the item up inside the authorized event; another event's is not found", async () => {
    allow("budget.manage");
    expect(await getItemFormContext(SENT, ITEM_B)).toEqual({ ok: false, reason: "not-found" });
    expect(repository.findItem).toHaveBeenCalledExactlyOnceWith(EVENT_A, ITEM_B);
    expect(repository.listBudget).not.toHaveBeenCalled();
  });

  it("offers only the authorized event's categories when adding", async () => {
    allow("budget.manage");
    await getItemFormContext(SENT);
    expect(repository.listBudget).toHaveBeenCalledExactlyOnceWith(EVENT_A);
  });

  it("refuses a viewer and a malformed ID before touching storage", async () => {
    allow("event.view");
    expect(await getItemFormContext(EVENT_A, ITEM_B)).toEqual({ ok: false, reason: "forbidden" });
    allow("budget.manage");
    expect(await getItemFormContext(EVENT_A, "nope")).toEqual({ ok: false, reason: "not-found" });
    expect(repository.findItem).not.toHaveBeenCalled();
  });
});