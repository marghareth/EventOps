// src/app/(app)/events/[eventId]/suppliers/[supplierId]/loading.tsx
// Shown while a supplier's detail or edit page loads (B4-07). Below the event layout, so a refused
// or unknown event still gets a real 404 (D-027, D-040).
import { LoadingState } from "@/components/shared/LoadingState";

export default function Loading() {
  return (
    <div className="rounded-xl bg-white shadow-xs">
      <LoadingState label="Loading the supplier" />
    </div>
  );
}