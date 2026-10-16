// src/app/(app)/events/[eventId]/budget/categories/new/page.tsx
// Add a budget category (B5-F01; D-084). Owners and Coordinators only (budget.manage). The check is
// made here and again in the server action and in the database.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UnauthorizedState } from "@/components/shared/UnauthorizedState";
import { CategoryForm } from "@/modules/events/budget/public";
import { authorizeEvent } from "@/modules/events/public";

export const metadata: Metadata = { title: "Add budget category" };

export default async function NewCategoryPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const basePath = `/events/${encodeURIComponent(eventId)}/budget`;
  const auth = await authorizeEvent(eventId, "budget.manage", `${basePath}/categories/new`);
  if (!auth.ok) {
    if (auth.reason === "not-found") notFound();
    return (
      <div className="rounded-xl bg-white shadow-xs">
        <UnauthorizedState kind="forbidden" href={basePath} linkLabel="Back to the budget" />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h2 font-extrabold">Add budget category</h1>
      <CategoryForm eventId={auth.event.id} cancelHref={basePath} />
    </div>
  );
}