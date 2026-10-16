// src/app/(app)/events/[eventId]/budget/items/[itemId]/edit/page.tsx
// Edit a budget item (B5-F02; D-085). The item is looked up only inside the authorized event, so
// another event's item is "not found". The loaded updatedAt travels with the form as its edit
// version (D-032).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UnauthorizedState } from "@/components/shared/UnauthorizedState";
import {
  formatBudgetItemReference,
  getItemFormContext,
  ItemForm,
} from "@/modules/events/budget/public";

export const metadata: Metadata = { title: "Edit budget item" };

export default async function EditItemPage({
  params,
}: {
  params: Promise<{ eventId: string; itemId: string }>;
}) {
  const { eventId, itemId } = await params;
  const basePath = `/events/${encodeURIComponent(eventId)}/budget`;
  const result = await getItemFormContext(eventId, itemId);
  if (!result.ok || !result.item) {
    if (!result.ok && result.reason === "forbidden") {
      return (
        <div className="rounded-xl bg-white shadow-xs">
          <UnauthorizedState kind="forbidden" href={basePath} linkLabel="Back to the budget" />
        </div>
      );
    }
    notFound();
  }
  const { item, categories } = result;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h2 font-extrabold">Edit budget item</h1>
      <ItemForm
        eventId={eventId}
        cancelHref={basePath}
        categories={categories}
        item={{
          id: item.id,
          reference: formatBudgetItemReference(item.number),
          categoryId: item.categoryId,
          name: item.name,
          estimated: item.estimated,
          committed: item.committed,
          paid: item.paid,
          notes: item.notes,
          version: item.updatedAt.toISOString(),
        }}
      />
    </div>
  );
}