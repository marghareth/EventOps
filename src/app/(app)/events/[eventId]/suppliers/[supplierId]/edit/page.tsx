// src/app/(app)/events/[eventId]/suppliers/[supplierId]/edit/page.tsx
// Edit supplier (B4-04, D-071) and Remove supplier (B4-05, D-072). Checks access itself (D-027).
// Owners and Coordinators get the form with the stored values and the edit version (D-032), and the
// remove section behind a confirmation; Viewers get "You don't have access" and
// nothing is loaded for them. An unknown supplier, a malformed ID or another event's supplier is
// "not found". The action authorizes again, so the page is never the security check.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UnauthorizedState } from "@/components/shared/UnauthorizedState";
import { can, requireEventAccess } from "@/modules/events/public";
import {
  RemoveSupplierSection,
  SupplierForm,
  deleteSupplierAction,
  formatSupplierReference,
  getSupplierForEditing,
  toSupplierFormValues,
  updateSupplierAction,
} from "@/modules/events/suppliers/public";

export const metadata: Metadata = { title: "Edit supplier" };

type Props = { params: Promise<{ eventId: string; supplierId: string }> };

export default async function EditSupplierPage({ params }: Props) {
  const { eventId, supplierId } = await params;
  const {
    access: { event },
  } = await requireEventAccess(eventId);
  const listHref = `/events/${event.id}/suppliers`;
  const refused = (
    <div className="rounded-xl bg-white shadow-xs">
      <UnauthorizedState kind="forbidden" href={listHref} linkLabel="Back to suppliers" />
    </div>
  );
  if (!can(event.role, "suppliers.manage")) return refused;

  const result = await getSupplierForEditing(event.id, supplierId);
  if (!result.ok) {
    if (result.reason === "not-found") notFound();
    return refused;
  }
  const { supplier } = result;
  const reference = formatSupplierReference(supplier.number);

  return (
    <div className="max-w-3xl">
      <p className="font-mono text-[13px] text-ink-2">{reference}</p>
      <h1 className="text-h2 font-extrabold wrap-break-word">Edit {supplier.name}</h1>
      <div className="mt-6 rounded-xl bg-white p-6 shadow-xs sm:p-8">
        <SupplierForm
          action={updateSupplierAction.bind(null, event.id, supplier.id)}
          cancelHref={listHref}
          mode="edit"
          saved={toSupplierFormValues(supplier)}
          version={supplier.updatedAt.toISOString()}
        />
      </div>
      <RemoveSupplierSection
        action={deleteSupplierAction.bind(null, event.id, supplier.id)}
        name={supplier.name}
        reference={reference}
      />
    </div>
  );
}