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
import { Decor } from "@/components/shared/Decor";
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
  read: "xl:grid-cols-[5.5rem_minmax(0,1fr)_9rem_9rem_9rem]",
  manage: "xl:grid-cols-[5.5rem_minmax(0,1fr)_9rem_9rem_9rem_13rem]",
} as const;

/**
 * One amount. On a phone it reads "Estimated ........ ₱500.00"; from xl up (wide enough for the columns, B10-F03) the label is hidden
 * (the column header shows it) but stays in the page for screen readers.
 */
function Amount({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex items-baseline justify-between gap-3 text-sm sm:block xl:text-right xl:text-base">
      <span className="text-ink-2 xl:sr-only">{label}</span>
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
      <section aria-labelledby="budget-totals">
        <h2 id="budget-totals" className="text-h3 font-bold">
          Event totals
        </h2>
        {/* D-118: one bento tile per total; the remaining (or over) tile is the emphasized one. */}
        <dl className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {(
            [
              ["Total allocated", eventSummary.allocated],
              ["Total estimated", eventSummary.estimated],
              ["Total committed", eventSummary.committed],
              ["Total paid", eventSummary.paid],
            ] as const
          ).map(([label, amount]) => (
            <div
              key={label}
              className="flex min-w-0 flex-col gap-2 rounded-xl bg-white p-5 shadow-xs"
            >
              <dt className="text-sm font-semibold text-ink-2">{label}</dt>
              <dd className="font-display text-2xl font-extrabold tracking-[-0.02em] tabular-nums wrap-break-word">
                {formatPesos(amount)}
              </dd>
            </div>
          ))}
          <div
            className={
              eventSummary.overBy === null
                ? "relative flex min-w-0 flex-col gap-2 overflow-hidden rounded-[28px] bg-lime p-5 text-ink"
                : "relative flex min-w-0 flex-col gap-2 overflow-hidden rounded-[28px] bg-ink p-5 text-white"
            }
          >
            <Decor shape="circle" className="-top-12 -right-12 size-32 text-white/30" />
            <dt className="relative text-sm font-semibold">
              {eventSummary.overBy === null ? "Remaining" : "Over by"}
            </dt>
            <dd className="relative flex flex-col items-start gap-2">
              <span className="font-display text-2xl font-extrabold tracking-[-0.02em] tabular-nums wrap-break-word">
                {formatPesos(eventSummary.overBy ?? eventSummary.remaining)}
              </span>
              <BudgetStatusBadge status={eventSummary.status} />
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-sm text-ink-2">
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
                    <dt className="text-ink-2">Allocation</dt>
                    <dd className="font-semibold tabular-nums">
                      {formatPesos(category.allocation)}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-ink-2">Estimated</dt>
                    <dd className="font-semibold tabular-nums">{formatPesos(totals.estimated)}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-ink-2">Committed</dt>
                    <dd className="font-semibold tabular-nums">{formatPesos(totals.committed)}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-ink-2">Paid</dt>
                    <dd className="font-semibold tabular-nums">{formatPesos(totals.paid)}</dd>
                  </div>
                </dl>
                {categorySummary ? (
                  <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-ink-2">
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
                    kind="category"
                    label={category.name}
                    action={deleteCategoryAction.bind(null, eventId, category.id)}
                  />
                </div>
              ) : null}
            </div>

            {category.items.length === 0 ? (
              <p className="mt-4 text-sm text-ink-2">
                No items in this category yet.
                {canManage ? " Use “Add item” to plan the first one." : ""}
              </p>
            ) : (
              <div className="mt-4">
                <div
                  aria-hidden="true"
                  className={`hidden border-b border-line px-0 pb-2 text-sm font-semibold xl:grid xl:gap-x-4 ${COLUMNS[canManage ? "manage" : "read"]}`}
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
                  className="flex flex-col gap-3 xl:gap-0"
                >
                  {category.items.map((item) => {
                    const reference = formatBudgetItemReference(item.number);
                    return (
                      <li
                        key={item.id}
                        className={`rounded-lg border border-line p-4 xl:grid xl:items-start xl:gap-x-4 xl:rounded-none xl:border-0 xl:border-b xl:border-line xl:px-0 xl:py-3 ${COLUMNS[canManage ? "manage" : "read"]}`}
                      >
                        <p className="font-mono text-sm xl:text-base">{reference}</p>
                        <div className="mt-1 min-w-0 xl:mt-0">
                          <p className="font-medium wrap-break-word">{item.name}</p>
                          {item.notes ? (
                            <p className="mt-0.5 text-xs wrap-break-word text-ink-2">
                              {item.notes}
                            </p>
                          ) : null}
                        </div>
                        <div className="mt-3 grid gap-1 sm:grid-cols-3 xl:contents">
                          <Amount label="Estimated" value={item.estimated} />
                          <Amount label="Committed" value={item.committed} />
                          <Amount label="Paid" value={item.paid} />
                        </div>
                        {canManage ? (
                          <div className="mt-3 flex flex-wrap items-start gap-2 xl:mt-0">
                            <Button asChild variant="secondary" size="sm">
                              <Link href={`${basePath}/items/${item.id}/edit`}>
                                <span aria-hidden="true">Edit</span>
                                <span className="sr-only">
                                  Edit {reference} {item.name}
                                </span>
                              </Link>
                            </Button>
                            <DeleteButton
                              kind="item"
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
                  className={`mt-3 grid gap-1 border-t border-line pt-3 font-semibold xl:mt-0 xl:gap-x-4 ${COLUMNS[canManage ? "manage" : "read"]} xl:items-start`}
                >
                  <p className="xl:col-span-2">Category total</p>
                  <div className="grid gap-1 sm:grid-cols-3 xl:contents">
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