// src/modules/events/budget/ui/BudgetList.tsx
// The budget as a list of categories, each with its items in an accessible table (B5-F01,
// B5-F02). Shows the stored amounts and plain sums of them (allocated, estimated, committed and paid; B5-F03 to B5-F06; D-086, D-087).
// No remaining amount, over-budget warning or status until their rules are approved. Edit, Delete and Add item appear only for people who can manage the budget; the
// server actions check the role again.
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { deleteCategoryAction, deleteItemAction } from "../actions";
import type { CategoryWithItems } from "../application/ports";
import { formatBudgetItemReference } from "../domain/budget.item";
import { formatPesos } from "../domain/budget.money";
import { totalAllocated, totalsOf } from "../domain/budget.totals";
import { DeleteButton } from "./DeleteButton";

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
  const eventTotals = totalsOf(
    categories.flatMap((category) => category.items),
  );
  const allocated = totalAllocated(categories);
  return (
    <div className="flex flex-col gap-6">
      <section
        aria-labelledby="budget-totals"
        className="rounded-xl bg-white p-5 shadow-xs"
      >
        <h2 id="budget-totals" className="text-h3 font-bold">
          Event totals
        </h2>
        <dl className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-sm text-muted-foreground">Total allocated</dt>
            <dd className="text-2xl font-extrabold tabular-nums">
              {formatPesos(allocated)}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Total estimated</dt>
            <dd className="text-2xl font-extrabold tabular-nums">
              {formatPesos(eventTotals.estimated)}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Total committed</dt>
            <dd className="text-2xl font-extrabold tabular-nums">
              {formatPesos(eventTotals.committed)}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Total paid</dt>
            <dd className="text-2xl font-extrabold tabular-nums">
              {formatPesos(eventTotals.paid)}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-sm text-muted-foreground">
          Sums of the amounts you entered. Allocated is what you set aside; paid
          is the actual cost recorded so far. None of these is a balance.
        </p>
      </section>
      {categories.map((category) => {
        const totals = totalsOf(category.items);
        return (
          <section
            key={category.id}
            aria-labelledby={`category-${category.id}`}
            className="rounded-xl bg-white p-5 shadow-xs"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2
                  id={`category-${category.id}`}
                  className="text-h3 font-bold"
                >
                  {category.name}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Allocation{" "}
                  <span className="font-semibold text-foreground">
                    {formatPesos(category.allocation)}
                  </span>
                  {" · "}Estimated{" "}
                  <span className="font-semibold text-foreground">
                    {formatPesos(totals.estimated)}
                  </span>
                  {" · "}Committed{" "}
                  <span className="font-semibold text-foreground">
                    {formatPesos(totals.committed)}
                  </span>
                  {" · "}Paid{" "}
                  <span className="font-semibold text-foreground">
                    {formatPesos(totals.paid)}
                  </span>
                </p>
              </div>
              {canManage ? (
                <div className="flex flex-wrap items-start gap-2">
                  <Button asChild variant="secondary" size="sm">
                    <Link
                      href={`${basePath}/items/new?category=${category.id}`}
                    >
                      <span aria-hidden="true">Add item</span>
                      <span className="sr-only">
                        Add item to {category.name}
                      </span>
                    </Link>
                  </Button>
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`${basePath}/categories/${category.id}/edit`}>
                      <span aria-hidden="true">Edit</span>
                      <span className="sr-only">
                        Edit category {category.name}
                      </span>
                    </Link>
                  </Button>
                  <DeleteButton
                    label={`category ${category.name}`}
                    action={deleteCategoryAction.bind(
                      null,
                      eventId,
                      category.id,
                    )}
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
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-160 border-collapse text-sm">
                  <caption className="sr-only">
                    Budget items in {category.name}
                  </caption>
                  <thead>
                    <tr className="border-b text-left">
                      <th scope="col" className="py-2 pr-4 font-semibold">
                        ID
                      </th>
                      <th scope="col" className="py-2 pr-4 font-semibold">
                        Item
                      </th>
                      <th
                        scope="col"
                        className="py-2 pr-4 text-right font-semibold"
                      >
                        Estimated
                      </th>
                      <th
                        scope="col"
                        className="py-2 pr-4 text-right font-semibold"
                      >
                        Committed
                      </th>
                      <th
                        scope="col"
                        className="py-2 pr-4 text-right font-semibold"
                      >
                        Paid
                      </th>
                      {canManage ? (
                        <th scope="col" className="py-2 font-semibold">
                          <span className="sr-only">Actions</span>
                        </th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {category.items.map((item) => {
                      const reference = formatBudgetItemReference(item.number);
                      return (
                        <tr
                          key={item.id}
                          className="border-b align-top last:border-b-0"
                        >
                          <td className="py-3 pr-4 font-mono">{reference}</td>
                          <th
                            scope="row"
                            className="py-3 pr-4 text-left font-medium"
                          >
                            {item.name}
                            {item.notes ? (
                              <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                                {item.notes}
                              </span>
                            ) : null}
                          </th>
                          <td className="py-3 pr-4 text-right tabular-nums">
                            {formatPesos(item.estimated)}
                          </td>
                          <td className="py-3 pr-4 text-right tabular-nums">
                            {formatPesos(item.committed)}
                          </td>
                          <td className="py-3 pr-4 text-right tabular-nums">
                            {formatPesos(item.paid)}
                          </td>
                          {canManage ? (
                            <td className="py-3">
                              <div className="flex flex-wrap items-start gap-2">
                                <Button asChild variant="secondary" size="sm">
                                  <Link
                                    href={`${basePath}/items/${item.id}/edit`}
                                  >
                                    <span aria-hidden="true">Edit</span>
                                    <span className="sr-only">
                                      Edit {reference} {item.name}
                                    </span>
                                  </Link>
                                </Button>
                                <DeleteButton
                                  label={`${reference} ${item.name}`}
                                  action={deleteItemAction.bind(
                                    null,
                                    eventId,
                                    item.id,
                                  )}
                                />
                              </div>
                            </td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t font-semibold">
                      <th
                        scope="row"
                        colSpan={2}
                        className="py-3 pr-4 text-left"
                      >
                        Category total
                      </th>
                      <td className="py-3 pr-4 text-right tabular-nums">
                        {formatPesos(totals.estimated)}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums">
                        {formatPesos(totals.committed)}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums">
                        {formatPesos(totals.paid)}
                      </td>
                      {canManage ? <td /> : null}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}