// src/app/(app)/events/[eventId]/suppliers/page.tsx
// The event's supplier list (B4-03, D-068). Every member can read it, contact details included
// (event.view); Owners and Coordinators also get "Add supplier" and an Edit link per supplier
// (suppliers.manage). Checks access itself (D-027); the read authorizes again, and every action
// checks once more. Search (B4-17, D-082) and filters (B4-18, D-083) come from the address and run
// on the server inside the authorized read.
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/EmptyState";
import { UnauthorizedState } from "@/components/shared/UnauthorizedState";
import { Button } from "@/components/ui/button";
import { requireEventAccess } from "@/modules/events/public";
import {
  SupplierList,
  SupplierListControls,
  SupplierNotice,
  formatSupplierReference,
  getEventSuppliers,
  describeSupplierQuery,
  isSupplierListNarrowed,
  isSupplierReference,
  parseSupplierListQuery,
} from "@/modules/events/suppliers/public";

export const metadata: Metadata = { title: "Suppliers" };

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function SuppliersPage({ params, searchParams }: Props) {
  // Membership is checked here too, not only in the event layout (D-027, B1-07).
  const {
    access: { event },
  } = await requireEventAccess((await params).eventId);
  const query = await searchParams;
  const listQuery = parseSupplierListQuery(query);
  const narrowed = isSupplierListNarrowed(listQuery);
  const result = await getEventSuppliers(event.id, listQuery);
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
  const { suppliers, total, canManage } = result;
  const listHref = `/events/${event.id}/suppliers`;
  const addHref = `${listHref}/new`;

  // After adding, editing or removing: the reference is shown only if well formed; the name comes
  // from the stored supplier, never from the address.
  const added = first(query.added);
  const saved = first(query.saved);
  const removed = first(query.removed);
  const notice = isSupplierReference(added)
    ? ({ kind: "added", reference: added } as const)
    : isSupplierReference(saved)
      ? ({ kind: "saved", reference: saved } as const)
      : isSupplierReference(removed)
        ? ({ kind: "removed", reference: removed } as const)
        : null;
  const noticeName = notice
    ? suppliers.find((s) => formatSupplierReference(s.number) === notice.reference)?.name
    : undefined;

  return (
    <div className="flex flex-col gap-6">
      {notice ? (
        <SupplierNotice kind={notice.kind} reference={notice.reference} name={noticeName} />
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-h2 font-extrabold">Suppliers</h1>
        {canManage ? (
          <Button asChild>
            <Link href={addHref}>Add supplier</Link>
          </Button>
        ) : null}
      </div>
      {total > 0 ? (
        <SupplierListControls query={listQuery} listHref={listHref} narrowed={narrowed} />
      ) : null}
      {total > 0 && narrowed ? (
        <p className="text-sm text-ink-2" role="status">
          {suppliers.length} of {total} {total === 1 ? "supplier matches" : "suppliers match"}.
        </p>
      ) : null}
      {total > 0 && suppliers.length === 0 ? (
        <div className="rounded-xl bg-white shadow-xs">
          <EmptyState
            headingLevel={2}
            title="No suppliers match"
            description={`${describeSupplierQuery(listQuery).join(" · ")}. Change the search or filters, or clear them to see all ${total} ${total === 1 ? "supplier" : "suppliers"}.`}
            action={
              <Button asChild variant="secondary">
                <Link href={listHref}>Clear search and filters</Link>
              </Button>
            }
          />
        </div>
      ) : suppliers.length === 0 ? (
        <div className="rounded-xl bg-white shadow-xs">
          <EmptyState
            headingLevel={2}
            title="No suppliers yet"
            description={
              canManage
                ? "Add your first supplier, for example the venue or the caterer."
                : "Owners and Coordinators can add suppliers to this event."
            }
            action={
              canManage ? (
                <Button asChild>
                  <Link href={addHref}>Add the first supplier</Link>
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <SupplierList suppliers={suppliers} basePath={listHref} canEdit={canManage} />
      )}
    </div>
  );
}