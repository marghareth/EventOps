// src/app/(app)/events/[eventId]/budget/categories/[categoryId]/edit/page.tsx
// Edit a budget category (B5-F01; D-084). The category is looked up only inside the authorized
// event, so another event's category is "not found". The loaded updatedAt travels with the form as
// its edit version (D-032).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UnauthorizedState } from "@/components/shared/UnauthorizedState";
import { CategoryForm, getCategoryForEdit } from "@/modules/events/budget/public";

export const metadata: Metadata = { title: "Edit budget category" };

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ eventId: string; categoryId: string }>;
}) {
  const { eventId, categoryId } = await params;
  const basePath = `/events/${encodeURIComponent(eventId)}/budget`;
  const result = await getCategoryForEdit(eventId, categoryId);
  if (!result.ok) {
    if (result.reason === "not-found") notFound();
    return (
      <div className="rounded-xl bg-white shadow-xs">
        <UnauthorizedState kind="forbidden" href={basePath} linkLabel="Back to the budget" />
      </div>
    );
  }
  const { category } = result;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h2 font-extrabold">Edit budget category</h1>
      <CategoryForm
        eventId={eventId}
        cancelHref={basePath}
        category={{
          id: category.id,
          name: category.name,
          allocation: category.allocation,
          version: category.updatedAt.toISOString(),
        }}
      />
    </div>
  );
}