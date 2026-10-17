// src/modules/events/budget/ui/BudgetList.tsx
// The budget as a list of categories, each with its items in an accessible table (B5-F01,
// B5-F02). Shows the stored amounts and plain sums of them (allocated, estimated, committed and paid; B5-F03 to B5-F06; D-086, D-087).
// Also shows the remaining budget and the Within or Over budget status of the event and of each
// category (B5-F07, B5-F08; D-088) and the over-budget warning with its reasons (B5-F09; D-090),
// all taken from budget-summary.ts, not calculated here. Edit,
// Delete and Add item appear only for people who can manage the budget; the server actions check
// the role again.
// Responsive (B5-F16): the items of a category are a list that is a stack of cards on a phone and
// a grid of columns from the md breakpoint, so nothing scrolls sideways at 375 px. The same markup
// serves both, so a screen reader never meets the items twice. A budget with categories but no
// items says so (B5-F15).
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { deleteCategoryAction, deleteItemAction } from "../actions";
import type { CategoryWithItems } from "../application/ports";
import { formatBudgetItemReference } from "../domain/budget.item";
import { formatPesos } from "../domain/budget.money";
import { overBudgetWarnings, summarizeEventBudget } from "../domain/budget-summary";
import { totalsOf } from "../domain/budget.totals";
import { BudgetStatusBadge } from "./BudgetStatusBadge";
import { DeleteButton } from "./DeleteButton";
import { OverBudgetWarning } from "./OverBudgetWarning";

/**
 * The item grid from the md breakpoint: ID, item, three amounts and, for people who can manage the
 * budget, the actions. Written out in full so Tailwind can see every class.
 */
const COLUMNS = {
  read: "md:grid-cols-[5.5rem_minmax(0,1fr)_9rem_9rem_9rem]",
  manage: "md:grid-cols-[5.5rem_minmax(0,1fr)_9rem_9rem_9rem_13rem]",
} as const;

/**
 * One amount. On a phone it reads "Estimated ........ ₱500.00"; from md up the label is hidden
 * (the column header shows it) but stays in the page for screen readers.
 */
function Amount({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex items-baseline justify-between gap-3 text-sm sm:block md:text-right md:text-base">
      <span className="text-muted-foreground md:sr-only">{label}</span>
      <span className="tabular-nums sm:block">{formatPesos(value)}</span>
    </p>
  );
}

export function BudgetList({
  eventId,
  categories,
  basePath,
  canManage,
}: {
  eventId: string;
  categories: CategoryWithItems[];
  basePath: string;
  canManage: boolean;
}) {
  const summary = summarizeEventBudget(categories);
  const eventSummary = summary.event;
  const warnings = overBudgetWarnings(summary);
  const hasNoItems = categories.every((category) => category.items.length === 0);
  return (
    <div className="flex flex-col gap-6">
      <OverBudgetWarning
        warnings={warnings}
        eventWithinBudget={eventSummary.status === "WITHIN_BUDGET"}
      />
      <section aria-labelledby="budget-totals" className="rounded-xl bg-white p-5 shadow-xs">
        <h2 id="budget-totals" className="text-h3 font-bold">
          Event totals
        </h2>
        <dl className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <div className="min-w-0">
            <dt className="text-sm text-muted-foreground">Total allocated</dt>
            <dd className="text-xl font-extrabold tabular-nums wrap-break-word sm:text-2xl">
              {formatPesos(eventSummary.allocated)}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-sm text-muted-foreground">Total estimated</dt>
            <dd className="text-xl font-extrabold tabular-nums wrap-break-word sm:text-2xl">
              {formatPesos(eventSummary.estimated)}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-sm text-muted-foreground">Total committed</dt>
            <dd className="text-xl font-extrabold tabular-nums wrap-break-word sm:text-2xl">
              {formatPesos(eventSummary.committed)}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-sm text-muted-foreground">Total paid</dt>
            <dd className="text-xl font-extrabold tabular-nums wrap-break-word sm:text-2xl">
              {formatPesos(eventSummary.paid)}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-sm text-muted-foreground">
              {eventSummary.overBy === null ? "Remaining" : "Over by"}
            </dt>
            <dd className="flex flex-col items-start gap-1">
              <span className="text-xl font-extrabold tabular-nums wrap-break-word sm:text-2xl">
                {formatPesos(eventSummary.overBy ?? eventSummary.remaining)}
              </span>
              <BudgetStatusBadge status={eventSummary.status} />
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-sm text-muted-foreground">
          Allocated is what you set aside; estimated, committed and paid are sums of the amounts you
          entered, and paid is the actual cost recorded so far. Remaining is allocated minus
          committed. Estimated above the allocation does not change the status.
        </p>
        {hasNoItems ? (
          <p className="mt-3 text-sm font-medium">
            No budget items yet, so every total is ₱0.00.
            {canManage ? " Use “Add item” in a category to plan the first one." : ""}
          </p>
        ) : null}
      </section>
      {categories.map((category, index) => {
        const totals = totalsOf(category.items);
        const categorySummary = summary.categories[index];
        return (
          <section
            key={category.id}
            aria-labelledby={`category-${category.id}`}
            className="rounded-xl bg-white p-5 shadow-xs"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 id={`category-${category.id}`} className="text-h3 font-bold wrap-break-word">
                  {category.name}
                </h2>
                <dl className="mt-1 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:flex sm:flex-wrap">
                  <div className="min-w-0">
                    <dt className="text-muted-foreground">Allocation</dt>
                    <dd className="font-semibold tabular-nums">
                      {formatPesos(category.allocation)}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-muted-foreground">Estimated</dt>
                    <dd className="font-semibold tabular-nums">{formatPesos(totals.estimated)}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-muted-foreground">Committed</dt>
                    <dd className="font-semibold tabular-nums">{formatPesos(totals.committed)}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-muted-foreground">Paid</dt>
                    <dd className="font-semibold tabular-nums">{formatPesos(totals.paid)}</dd>
                  </div>
                </dl>
                {categorySummary ? (
                  <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-muted-foreground">
                      {categorySummary.overBy === null ? "Remaining" : "Over by"}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {formatPesos(categorySummary.overBy ?? categorySummary.remaining)}
                    </span>
                    <BudgetStatusBadge status={categorySummary.status} />
                  </p>
                ) : null}
              </div>
              {canManage ? (
                <div className="flex flex-wrap items-start gap-2">
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`${basePath}/items/new?category=${category.id}`}>
                      <span aria-hidden="true">Add item</span>
                      <span className="sr-only">Add item to {category.name}</span>
                    </Link>
                  </Button>
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`${basePath}/categories/${category.id}/edit`}>
                      <span aria-hidden="true">Edit</span>
                      <span className="sr-only">Edit category {category.name}</span>
                    </Link>
                  </Button>
                  <DeleteButton
                    label={`category ${category.name}`}
                    action={deleteCategoryAction.bind(null, eventId, category.id)}
                  />
                </div>
              ) : null}
            </div>

            {category.items.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                No items in this category yet.
                {canManage ? " Use “Add item” to plan the first one." : ""}
              </p>
            ) : (
              <div className="mt-4">
                <div
                  aria-hidden="true"
                  className={`hidden border-b px-0 pb-2 text-sm font-semibold md:grid md:gap-x-4 ${COLUMNS[canManage ? "manage" : "read"]}`}
                >
                  <span>ID</span>
                  <span>Item</span>
                  <span className="text-right">Estimated</span>
                  <span className="text-right">Committed</span>
                  <span className="text-right">Paid</span>
                  {canManage ? <span /> : null}
                </div>
                <ul
                  aria-label={`Budget items in ${category.name}`}
                  className="flex flex-col gap-3 md:gap-0"
                >
                  {category.items.map((item) => {
                    const reference = formatBudgetItemReference(item.number);
                    return (
                      <li
                        key={item.id}
                        className={`rounded-lg border p-4 md:grid md:items-start md:gap-x-4 md:rounded-none md:border-0 md:border-b md:px-0 md:py-3 ${COLUMNS[canManage ? "manage" : "read"]}`}
                      >
                        <p className="font-mono text-sm md:text-base">{reference}</p>
                        <div className="mt-1 min-w-0 md:mt-0">
                          <p className="font-medium wrap-break-word">{item.name}</p>
                          {item.notes ? (
                            <p className="mt-0.5 text-xs wrap-break-words text-muted-foreground">
                              {item.notes}
                            </p>
                          ) : null}
                        </div>
                        <div className="mt-3 grid gap-1 sm:grid-cols-3 md:contents">
                          <Amount label="Estimated" value={item.estimated} />
                          <Amount label="Committed" value={item.committed} />
                          <Amount label="Paid" value={item.paid} />
                        </div>
                        {canManage ? (
                          <div className="mt-3 flex flex-wrap items-start gap-2 md:mt-0">
                            <Button asChild variant="secondary" size="sm">
                              <Link href={`${basePath}/items/${item.id}/edit`}>
                                <span aria-hidden="true">Edit</span>
                                <span className="sr-only">
                                  Edit {reference} {item.name}
                                </span>
                              </Link>
                            </Button>
                            <DeleteButton
                              label={`${reference} ${item.name}`}
                              action={deleteItemAction.bind(null, eventId, item.id)}
                            />
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
                <div
                  className={`mt-3 grid gap-1 border-t pt-3 font-semibold md:mt-0 md:gap-x-4 ${COLUMNS[canManage ? "manage" : "read"]} md:items-start`}
                >
                  <p className="md:col-span-2">Category total</p>
                  <div className="grid gap-1 sm:grid-cols-3 md:contents">
                    <Amount label="Estimated" value={totals.estimated} />
                    <Amount label="Committed" value={totals.committed} />
                    <Amount label="Paid" value={totals.paid} />
                  </div>
                </div>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}