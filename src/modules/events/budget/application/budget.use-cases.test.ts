// src/modules/events/budget/application/budget.use-cases.test.ts
// The update use cases against an in-memory repository: "nothing changed" writes nothing, a move to
// another event's category is "not found", and a real change reaches storage with its changes.
import { describe, expect, it, vi } from "vitest";
import type { BudgetRepository, CategoryRecord, ItemWithCategory } from "./ports";
import { updateCategory } from "./update-category";
import { updateItem } from "./update-item";

const EVENT = "e0000000-0000-4000-8000-000000000001";
const ACTOR = "a0000000-0000-4000-8000-000000000001";
const CAT_A = "c0000000-0000-4000-8000-00000000000a";
const CAT_B = "c0000000-0000-4000-8000-00000000000b";
const ITEM = "10000000-0000-4000-8000-000000000001";
const version = new Date("2026-10-15T09:00:00.000Z");

const category: CategoryRecord = { id: CAT_A, name: "Venue", allocation: "100000.00", updatedAt: version };
const item: ItemWithCategory = {
  id: ITEM,
  number: 4,
  categoryId: CAT_A,
  name: "Deposit",
  estimated: "50000.00",
  committed: "0.00",
  paid: "0.00",
  notes: null,
  updatedAt: version,
  categoryName: "Venue",
};

function fakeRepository(overrides: Partial<BudgetRepository> = {}): BudgetRepository {
  return {
    listBudget: vi.fn(),
    findCategory: vi.fn(async (_e, id) => (id === CAT_A ? category : null)),
    findItem: vi.fn(async (_e, id) => (id === ITEM ? item : null)),
    createCategory: vi.fn(),
    updateCategory: vi.fn(async () => ({ ok: true }) as const),
    deleteCategory: vi.fn(),
    createItem: vi.fn(),
    updateItem: vi.fn(async () => ({ ok: true }) as const),
    deleteItem: vi.fn(),
    ...overrides,
  } as BudgetRepository;
}

describe("updateCategory", () => {
  it("reports unchanged and writes nothing when the values are the same", async () => {
    const repo = fakeRepository();
    const result = await updateCategory(repo, {
      eventId: EVENT, categoryId: CAT_A, actorId: ACTOR, version,
      input: { name: "Venue", allocation: "100000.00" },
    });
    expect(result).toEqual({ ok: true, unchanged: true });
    expect(repo.updateCategory).not.toHaveBeenCalled();
  });

  it("passes only the fields that changed", async () => {
    const repo = fakeRepository();
    await updateCategory(repo, {
      eventId: EVENT, categoryId: CAT_A, actorId: ACTOR, version,
      input: { name: "Venue", allocation: "120000.00" },
    });
    expect(repo.updateCategory).toHaveBeenCalledWith(
      expect.objectContaining({
        changes: { allocation: { from: "100000.00", to: "120000.00" } },
      }),
    );
  });

  it("is not found for a category outside the event", async () => {
    const result = await updateCategory(fakeRepository(), {
      eventId: EVENT, categoryId: CAT_B, actorId: ACTOR, version,
      input: { name: "X", allocation: "0.00" },
    });
    expect(result).toEqual({ ok: false, reason: "not-found" });
  });
});

describe("updateItem", () => {
  const base = {
    categoryId: CAT_A, name: "Deposit", estimated: "50000.00",
    committed: "0.00", paid: "0.00", notes: null,
  };

  it("reports unchanged and writes nothing when the values are the same", async () => {
    const repo = fakeRepository();
    const result = await updateItem(repo, {
      eventId: EVENT, itemId: ITEM, actorId: ACTOR, version, input: base,
    });
    expect(result).toEqual({ ok: true, unchanged: true });
    expect(repo.updateItem).not.toHaveBeenCalled();
  });

  it("refuses a move to a category that is not in this event", async () => {
    const repo = fakeRepository();
    const result = await updateItem(repo, {
      eventId: EVENT, itemId: ITEM, actorId: ACTOR, version,
      input: { ...base, categoryId: CAT_B },
    });
    expect(result).toEqual({ ok: false, reason: "not-found" });
    expect(repo.updateItem).not.toHaveBeenCalled();
  });

  it("records that notes changed without copying them", async () => {
    const repo = fakeRepository();
    await updateItem(repo, {
      eventId: EVENT, itemId: ITEM, actorId: ACTOR, version,
      input: { ...base, notes: "Paid in two parts" },
    });
    expect(repo.updateItem).toHaveBeenCalledWith(
      expect.objectContaining({ changes: { notes: { from: null, to: null } } }),
    );
  });

  it("is not found for an item outside the event", async () => {
    const result = await updateItem(fakeRepository(), {
      eventId: EVENT, itemId: "99999999-0000-4000-8000-000000000009", actorId: ACTOR, version, input: base,
    });
    expect(result).toEqual({ ok: false, reason: "not-found" });
  });
});