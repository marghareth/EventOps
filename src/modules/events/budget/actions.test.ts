// src/modules/events/budget/actions.test.ts
// @vitest-environment node
// Budget server actions (B5-F11, B5-F12; D-035, D-036, D-084, D-085) with authorization, storage and
// Next.js replaced. Each action authorizes before it reads the form or touches storage; uses only
// the IDs authorization returned, never form fields; validates on the server; and fails safely.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BUDGET_MESSAGES } from "./form-state";

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
  listBudget: vi.fn(),
  findCategory: vi.fn(),
  findItem: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
  createItem: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
};
vi.mock("./composition", () => ({ budgetRepository: () => repository }));

const {
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
  createItemAction,
  updateItemAction,
  deleteItemAction,
} = await import("./actions");
const { can, rolesAllowed } = await import("../permissions");

const EVENT = "e0000000-0000-4000-8000-00000000000a";
const OTHER_EVENT = "e0000000-0000-4000-8000-00000000000b";
const CATEGORY = "c0000000-0000-4000-8000-00000000000a";
const ITEM = "10000000-0000-4000-8000-00000000000a";
const VERSION = "2026-10-16T00:00:00.000Z";
const USER = { id: "u0000000-0000-4000-8000-00000000000a", email: "mika@example.test" };
const idle = { status: "idle" } as const;

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}
const categoryFields = { name: "Venue", allocation: "5000" };
const itemFields = {
  categoryId: CATEGORY,
  name: "Deposit",
  estimated: "1000",
  committed: "",
  paid: "",
  notes: "",
};

const allow = () =>
  authorizeEvent.mockResolvedValue({ ok: true, user: USER, event: { id: EVENT } });
const refuse = (reason: "forbidden" | "not-found") =>
  authorizeEvent.mockResolvedValue({ ok: false, reason });

/** The answer, or the address a redirect() went to. */
async function run(call: () => Promise<unknown>) {
  try {
    return { answer: await call() };
  } catch (error) {
    const url = (error as { url?: string }).url;
    if (url) return { redirected: url };
    throw error;
  }
}

const ACTIONS = {
  "add a category": () => createCategoryAction(OTHER_EVENT, idle, form(categoryFields)),
  "edit a category": () =>
    updateCategoryAction(
      OTHER_EVENT,
      CATEGORY,
      idle,
      form({ ...categoryFields, version: VERSION }),
    ),
  "delete a category": () => deleteCategoryAction(OTHER_EVENT, CATEGORY),
  "add an item": () => createItemAction(OTHER_EVENT, idle, form(itemFields)),
  "edit an item": () =>
    updateItemAction(OTHER_EVENT, ITEM, idle, form({ ...itemFields, version: VERSION })),
  "delete an item": () => deleteItemAction(OTHER_EVENT, ITEM),
} as const;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("budget permissions (D-035)", () => {
  it("lets every role view the budget but only Owners and Coordinators change it", () => {
    expect([...rolesAllowed("event.view")].sort()).toEqual(["COORDINATOR", "OWNER", "VIEWER"]);
    expect([...rolesAllowed("budget.manage")].sort()).toEqual(["COORDINATOR", "OWNER"]);
    expect(can("VIEWER", "budget.manage")).toBe(false);
  });
});

describe.each(Object.entries(ACTIONS))("%s", (_label, call) => {
  it.each(["forbidden", "not-found"] as const)(
    "is refused when authorization says %s, and touches no storage",
    async (reason) => {
      refuse(reason);
      const { answer } = await run(call);
      expect(answer).toMatchObject({ status: "error" });
      expect(authorizeEvent).toHaveBeenCalledWith(OTHER_EVENT, "budget.manage", expect.any(String));
      for (const method of Object.values(repository)) expect(method).not.toHaveBeenCalled();
    },
  );

  it("asks for the budget.manage permission, never a weaker one", async () => {
    refuse("forbidden");
    await run(call);
    expect(authorizeEvent.mock.calls[0]?.[1]).toBe("budget.manage");
  });
});

describe("the IDs that count", () => {
  it("adds a category to the authorized event as the authorized user, ignoring form fields", async () => {
    allow();
    repository.createCategory.mockResolvedValue({ ok: true, id: CATEGORY });
    const { redirected } = await run(() =>
      createCategoryAction(
        OTHER_EVENT,
        idle,
        form({
          ...categoryFields,
          eventId: OTHER_EVENT,
          actorId: "someone-else",
          createdById: "x",
        }),
      ),
    );
    expect(redirected).toContain(`/events/${EVENT}/budget?notice=category-added`);
    expect(repository.createCategory).toHaveBeenCalledExactlyOnceWith({
      eventId: EVENT,
      actorId: USER.id,
      input: { name: "Venue", allocation: "5000.00" },
    });
  });

  it("adds an item with only the editable fields, in the authorized event", async () => {
    allow();
    repository.createItem.mockResolvedValue({ ok: true, id: ITEM, number: 3 });
    const { redirected } = await run(() =>
      createItemAction(
        OTHER_EVENT,
        idle,
        form({ ...itemFields, eventId: OTHER_EVENT, number: "99", id: "x" }),
      ),
    );
    expect(redirected).toContain("notice=item-added&ref=BUD-0003");
    expect(repository.createItem).toHaveBeenCalledExactlyOnceWith({
      eventId: EVENT,
      actorId: USER.id,
      input: {
        categoryId: CATEGORY,
        name: "Deposit",
        estimated: "1000.00",
        committed: "0.00",
        paid: "0.00",
        notes: null,
      },
    });
  });

  it("deletes inside the authorized event only", async () => {
    allow();
    repository.deleteItem.mockResolvedValue({ ok: true, number: 4, name: "Deposit" });
    await run(() => deleteItemAction(OTHER_EVENT, ITEM));
    expect(repository.deleteItem).toHaveBeenCalledExactlyOnceWith({
      eventId: EVENT,
      itemId: ITEM,
      actorId: USER.id,
    });
  });
});

describe("validation happens on the server before storage (B5-F12)", () => {
  beforeEach(allow);

  it("returns field errors and saves nothing for a bad category", async () => {
    const { answer } = await run(() =>
      createCategoryAction(EVENT, idle, form({ name: "   ", allocation: "-5" })),
    );
    expect(answer).toMatchObject({
      status: "error",
      fieldErrors: { name: expect.any(String), allocation: expect.any(String) },
      values: { name: "   ", allocation: "-5" },
    });
    expect(repository.createCategory).not.toHaveBeenCalled();
  });

  it("returns field errors and saves nothing for a bad item", async () => {
    const { answer } = await run(() =>
      createItemAction(
        EVENT,
        idle,
        form({ ...itemFields, categoryId: "not-a-uuid", estimated: "", paid: "1.234" }),
      ),
    );
    expect(answer).toMatchObject({
      status: "error",
      fieldErrors: {
        categoryId: expect.any(String),
        estimated: expect.any(String),
        paid: expect.any(String),
      },
    });
    expect(repository.createItem).not.toHaveBeenCalled();
  });

  it("treats a missing field as blank, not as a crash", async () => {
    const { answer } = await run(() => createCategoryAction(EVENT, idle, form({})));
    expect(answer).toMatchObject({ status: "error", fieldErrors: { name: expect.any(String) } });
  });

  it("refuses a malformed record ID or version without touching storage", async () => {
    const badId = await run(() =>
      updateItemAction(EVENT, "nope", idle, form({ ...itemFields, version: VERSION })),
    );
    expect(badId.answer).toMatchObject({ status: "error", message: BUDGET_MESSAGES.itemNotFound });
    const badVersion = await run(() =>
      updateCategoryAction(
        EVENT,
        CATEGORY,
        idle,
        form({ ...categoryFields, version: "yesterday" }),
      ),
    );
    expect(badVersion.answer).toMatchObject({
      status: "error",
      message: BUDGET_MESSAGES.categoryStale,
    });
    expect((await run(() => deleteCategoryAction(EVENT, "nope"))).answer).toMatchObject({
      status: "error",
      message: BUDGET_MESSAGES.categoryNotFound,
    });
    expect(repository.findItem).not.toHaveBeenCalled();
    expect(repository.updateCategory).not.toHaveBeenCalled();
    expect(repository.deleteCategory).not.toHaveBeenCalled();
  });
});

describe("failures are safe and honest", () => {
  beforeEach(allow);

  it("says the category no longer exists when an item's category is not in this event", async () => {
    repository.createItem.mockResolvedValue({ ok: false, reason: "not-found" });
    const { answer } = await run(() => createItemAction(EVENT, idle, form(itemFields)));
    expect(answer).toMatchObject({ status: "error", message: BUDGET_MESSAGES.categoryNotFound });
  });

  it("reports a role change after the check as forbidden, in the database", async () => {
    repository.createCategory.mockResolvedValue({ ok: false, reason: "not-found" });
    const { answer } = await run(() => createCategoryAction(EVENT, idle, form(categoryFields)));
    expect(answer).toMatchObject({ status: "error", message: BUDGET_MESSAGES.forbidden });
  });

  it("reports a duplicate category name on the name field", async () => {
    repository.createCategory.mockResolvedValue({ ok: false, reason: "duplicate" });
    const { answer } = await run(() => createCategoryAction(EVENT, idle, form(categoryFields)));
    expect(answer).toMatchObject({
      status: "error",
      fieldErrors: { name: BUDGET_MESSAGES.duplicateName },
    });
  });

  it("never reports success when storage throws", async () => {
    repository.createItem.mockRejectedValue(new Error("connection refused: secret-host"));
    const { answer, redirected } = await run(() => createItemAction(EVENT, idle, form(itemFields)));
    expect(redirected).toBeUndefined();
    expect(answer).toMatchObject({ status: "error", message: BUDGET_MESSAGES.saveFailed });
    expect(JSON.stringify(answer)).not.toContain("secret-host");
  });

  it("refuses deleting a category that still has items, saying how many", async () => {
    repository.deleteCategory.mockResolvedValue({ ok: false, reason: "not-empty", count: 2 });
    const { answer } = await run(() => deleteCategoryAction(EVENT, CATEGORY));
    expect(answer).toEqual({ status: "error", message: BUDGET_MESSAGES.categoryHasItems(2) });
  });

  it("says nothing changed, and writes nothing, for an unchanged edit", async () => {
    repository.findItem.mockResolvedValue({
      id: ITEM,
      number: 1,
      categoryId: CATEGORY,
      name: "Deposit",
      estimated: "1000.00",
      committed: "0.00",
      paid: "0.00",
      notes: null,
      updatedAt: new Date(VERSION),
      categoryName: "Venue",
    });
    repository.findCategory.mockResolvedValue({
      id: CATEGORY,
      name: "Venue",
      allocation: "5000.00",
      updatedAt: new Date(VERSION),
    });
    const { answer } = await run(() =>
      updateItemAction(EVENT, ITEM, idle, form({ ...itemFields, version: VERSION })),
    );
    expect(answer).toEqual({ status: "success", message: BUDGET_MESSAGES.unchanged });
    expect(repository.updateItem).not.toHaveBeenCalled();
  });
});