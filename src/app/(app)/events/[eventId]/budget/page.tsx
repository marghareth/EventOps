// src/app/(app)/events/[eventId]/budget/page.tsx
// The event's budget (B5-F01 categories, B5-F02 items; D-084, D-085). Every member can read it
// (event.view); Owners and Coordinators also get "Add category", "Add item" and Edit links
// (budget.manage). Checks access itself (D-027); the read authorizes again, and every action checks
// once more. Shows stored values only: totals, remaining amounts and statuses come with their own
// task, once their rules are approved.
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/EmptyState";
import { UnauthorizedState } from "@/components/shared/UnauthorizedState";
import { Button } from "@/components/ui/button";
import {
  BudgetList,
  BudgetNotice,
  formatBudgetItemReference,
  getEventBudget,
  isBudgetItemReference,
  type BudgetNoticeKind,
} from "@/modules/events/budget/public";
import { requireEventAccess } from "@/modules/events/public";

export const metadata: Metadata = { title: "Budget" };

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS: readonly BudgetNoticeKind[] = [
  "category-added",
  "category-saved",
  "category-removed",
  "item-added",
  "item-saved",
  "item-removed",
];

export default async function BudgetPage({ params, searchParams }: Props) {
  // Membership is checked here too, not only in the event layout (D-027, B1-07).
  const {
    access: { event },
  } = await requireEventAccess((await params).eventId);
  const query = await searchParams;
  const result = await getEventBudget(event.id);
  if (!result.ok) {
    return (
      <div className="rounded-xl bg-white shadow-xs">
        <UnauthorizedState
          kind="forbidden"
          href={`/events/${event.id}`}
          linkLabel="Back to the overview"
        />
      </div>
    );
  }
  const { categories, canManage } = result;
  const basePath = `/events/${event.id}/budget`;

  // After a change: only a known kind and a well-formed reference are used. The name shown comes
  // from the stored record, never from the address.
  const kind = KINDS.find((k) => k === first(query.notice));
  const ref = first(query.ref);
  let notice: { kind: BudgetNoticeKind; name?: string; reference?: string } | null = null;
  if (kind === "category-removed") notice = { kind };
  else if ((kind === "category-added" || kind === "category-saved") && ref && UUID.test(ref)) {
    notice = { kind, name: categories.find((c) => c.id === ref)?.name };
  } else if (kind && kind.startsWith("item-") && isBudgetItemReference(ref)) {
    const name =
      kind === "item-removed"
        ? undefined
        : categories
            .flatMap((c) => c.items)
            .find((i) => formatBudgetItemReference(i.number) === ref)?.name;
    notice = { kind, name, reference: ref };
  }

  return (
    <div className="flex flex-col gap-6">
      {notice ? (
        <BudgetNotice kind={notice.kind} name={notice.name} reference={notice.reference} />
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-h2 font-extrabold">Budget</h1>
        {canManage ? (
          <div className="flex flex-wrap gap-3">
            {categories.length > 0 ? (
              <Button asChild variant="secondary">
                <Link href={`${basePath}/items/new`}>Add item</Link>
              </Button>
            ) : null}
            <Button asChild>
              <Link href={`${basePath}/categories/new`}>Add category</Link>
            </Button>
          </div>
        ) : null}
      </div>
      {categories.length === 0 ? (
        <div className="rounded-xl bg-white shadow-xs">
          <EmptyState
            headingLevel={2}
            title="No budget categories yet"
            description={
              canManage
                ? "Add your first category, for example Venue or Catering, then plan its items."
                : "Owners and Coordinators can add budget categories to this event."
            }
            action={
              canManage ? (
                <Button asChild>
                  <Link href={`${basePath}/categories/new`}>Add the first category</Link>
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <BudgetList
          eventId={event.id}
          categories={categories}
          basePath={basePath}
          canManage={canManage}
        />
      )}
    </div>
  );
}