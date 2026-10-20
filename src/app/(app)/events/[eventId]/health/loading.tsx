// src/app/(app)/events/[eventId]/health/loading.tsx
// Shown while the Health page loads and runs its checks (B8-F19). Below the event layout, so a
// refused or unknown event still gets a real 404 (D-027, D-040).
import { LoadingState } from "@/components/shared/LoadingState";

export default function Loading() {
  return (
    <div className="rounded-xl bg-white shadow-xs">
      <LoadingState label="Loading event health" />
    </div>
  );
}