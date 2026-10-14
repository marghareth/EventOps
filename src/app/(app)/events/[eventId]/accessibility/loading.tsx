// src/app/(app)/events/[eventId]/accessibility/loading.tsx
// Shown while the Accessibility page or a resource form loads (B3-06). Below the event layout, so a
// refused or unknown event still gets a real 404 (D-027, D-040).
import { LoadingState } from "@/components/shared/LoadingState";

export default function Loading() {
  return (
    <div className="rounded-xl bg-white shadow-xs">
      <LoadingState label="Loading accessibility" />
    </div>
  );
}