// src/app/(app)/events/[eventId]/suppliers/loading.tsx
// Shown while the supplier list or the add and edit pages load (B4-03). Below
// the event layout, so a refused or unknown event still gets a real 404 (D-027, D-040).
import { LoadingState } from "@/components/shared/LoadingState";

export default function Loading() {
  return (
    <div className="rounded-xl bg-white shadow-xs">
      <LoadingState label="Loading suppliers" />
    </div>
  );
}