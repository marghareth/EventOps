// src/app/(app)/events/[eventId]/suppliers/new/page.tsx
// Add supplier (B4-03, D-070). Checks access itself (D-027). Owners and Coordinators get the form
// (suppliers.manage, D-035); Viewers get "You don't have access", even when they type the address.
// The action authorizes again, so the page is never the security check.
import type { Metadata } from "next";
import { UnauthorizedState } from "@/components/shared/UnauthorizedState";
import { can, requireEventAccess } from "@/modules/events/public";
import { SupplierForm, createSupplierAction } from "@/modules/events/suppliers/public";

export const metadata: Metadata = { title: "Add supplier" };

export default async function AddSupplierPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const {
    access: { event },
  } = await requireEventAccess((await params).eventId);
  const listHref = `/events/${event.id}/suppliers`;

  if (!can(event.role, "suppliers.manage")) {
    return (
      <div className="rounded-xl bg-white shadow-xs">
        <UnauthorizedState kind="forbidden" href={listHref} linkLabel="Back to suppliers" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-h2 font-extrabold">Add a supplier</h1>
      <p className="mt-2 text-ink-2">
        Name and category are required. Everything else is optional.
      </p>
      <div className="mt-6 rounded-xl bg-white p-6 shadow-xs sm:p-8">
        <SupplierForm action={createSupplierAction.bind(null, event.id)} cancelHref={listHref} />
      </div>
    </div>
  );
}