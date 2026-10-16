// src/app/(app)/events/[eventId]/budget/items/new/page.tsx
// Add a budget item (B5-F02; D-085). Owners and Coordinators only. ?category=<id> pre-selects a
// category, but only if it is one of this event's categories; anything else is ignored. An event
// with no categories is sent to add one first.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/shared/EmptyState";
import { UnauthorizedState } from "@/components/shared/UnauthorizedState";
import { Button } from "@/components/ui/button";
import { getItemFormContext, ItemForm } from "@/modules/events/budget/public";

export const metadata: Metadata = { title: "Add budget item" };

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewItemPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const query = await searchParams;
  const basePath = `/events/${encodeURIComponent(eventId)}/budget`;
  const result = await getItemFormContext(eventId);
  if (!result.ok) {
    if (result.reason === "not-found") notFound();
    return (
      <div className="rounded-xl bg-white shadow-xs">
        <UnauthorizedState kind="forbidden" href={basePath} linkLabel="Back to the budget" />
      </div>
    );
  }
  if (result.categories.length === 0) {
    return (
      <div className="rounded-xl bg-white shadow-xs">
        <EmptyState
          headingLevel={1}
          title="Add a category first"
          description="Budget items live inside a category, for example Venue or Catering."
          action={
            <Button asChild>
              <Link href={`${basePath}/categories/new`}>Add a category</Link>
            </Button>
          }
        />
      </div>
    );
  }
  const requested = Array.isArray(query.category) ? query.category[0] : query.category;
  const defaultCategoryId = result.categories.find((c) => c.id === requested)?.id;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h2 font-extrabold">Add budget item</h1>
      <ItemForm
        eventId={eventId}
        cancelHref={basePath}
        categories={result.categories}
        defaultCategoryId={defaultCategoryId}
      />
    </div>
  );
}