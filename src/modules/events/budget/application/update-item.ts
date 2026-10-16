// src/modules/events/budget/application/update-item.ts
// Saves a budget item, including a move to another category of the same event (B5-F02; D-085).
// The target category must exist in this event: another event's category is "not found". A save
// that changes nothing is reported as "unchanged" and writes nothing.
import { BUDGET_ITEM_CHANGE_FIELDS } from "../domain/budget.item";
import { diffFields, hasChanges, redactFields } from "../domain/budget.changes";
import type { ItemInput } from "../schema";
import type { BudgetRepository } from "./ports";

export async function updateItem(
  repository: BudgetRepository,
  args: {
    eventId: string;
    itemId: string;
    actorId: string;
    version: Date;
    input: ItemInput;
  },
) {
  const current = await repository.findItem(args.eventId, args.itemId);
  if (!current) return { ok: false, reason: "not-found" } as const;

  const category = await repository.findCategory(args.eventId, args.input.categoryId);
  if (!category) return { ok: false, reason: "not-found" } as const;

  const changes = diffFields(
    BUDGET_ITEM_CHANGE_FIELDS,
    {
      categoryId: current.categoryId,
      name: current.name,
      estimated: current.estimated,
      committed: current.committed,
      paid: current.paid,
      notes: current.notes,
    },
    {
      categoryId: args.input.categoryId,
      name: args.input.name,
      estimated: args.input.estimated,
      committed: args.input.committed,
      paid: args.input.paid,
      notes: args.input.notes,
    },
  );
  if (!hasChanges(changes)) return { ok: true, unchanged: true } as const;
  // Notes are never copied into the audit log (D-085): the entry only says they changed.
  return repository.updateItem({ ...args, changes: redactFields(changes, ["notes"]) });
}