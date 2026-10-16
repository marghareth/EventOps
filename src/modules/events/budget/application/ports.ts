// src/modules/events/budget/application/ports.ts
// What the budget use cases need from storage (B5-F01, B5-F02; D-084, D-085). The Prisma repository
// implements it; tests use an in-memory fake. Money is always a two-place string ("1500.00").
import type { FieldChanges } from "../domain/budget.changes";
import type { CategoryInput, ItemInput } from "../schema";

export type CategoryRecord = {
  id: string;
  name: string;
  allocation: string;
  /** The edit version (D-032). Sent back on save; an older value is refused as stale. */
  updatedAt: Date;
};

export type ItemRecord = {
  id: string;
  number: number;
  categoryId: string;
  name: string;
  estimated: string;
  committed: string;
  paid: string;
  notes: string | null;
  updatedAt: Date;
};

export type CategoryWithItems = CategoryRecord & { items: ItemRecord[] };
export type ItemWithCategory = ItemRecord & { categoryName: string };

type Actor = { eventId: string; actorId: string };

export interface BudgetRepository {
  listBudget(eventId: string): Promise<CategoryWithItems[]>;
  findCategory(eventId: string, categoryId: string): Promise<CategoryRecord | null>;
  findItem(eventId: string, itemId: string): Promise<ItemWithCategory | null>;

  createCategory(
    args: Actor & { input: CategoryInput },
  ): Promise<{ ok: true; id: string } | { ok: false; reason: "not-found" | "duplicate" }>;
  updateCategory(
    args: Actor & {
      categoryId: string;
      version: Date;
      input: CategoryInput;
      changes: FieldChanges;
    },
  ): Promise<{ ok: true } | { ok: false; reason: "stale" | "not-found" | "duplicate" }>;
  deleteCategory(
    args: Actor & { categoryId: string },
  ): Promise<
    | { ok: true; name: string }
    | { ok: false; reason: "not-found" }
    | { ok: false; reason: "not-empty"; count: number }
  >;

  createItem(
    args: Actor & { input: ItemInput },
  ): Promise<{ ok: true; id: string; number: number } | { ok: false; reason: "not-found" }>;
  updateItem(
    args: Actor & { itemId: string; version: Date; input: ItemInput; changes: FieldChanges },
  ): Promise<{ ok: true } | { ok: false; reason: "stale" | "not-found" }>;
  deleteItem(
    args: Actor & { itemId: string },
  ): Promise<{ ok: true; number: number; name: string } | { ok: false; reason: "not-found" }>;
}