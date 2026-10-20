// src/app/(app)/events/[eventId]/impact/loading.tsx
// Shown while the Impact page loads and runs its analysis (B7-F17). Below the event layout, so a refused or unknown event still gets a real 404 (D-027, D-040).
import { LoadingState } from "@/components/shared/LoadingState";

export default function Loading() {
  return (
    <div className="rounded-xl bg-white shadow-xs">
      <LoadingState label="Loading the impact analysis" />
    </div>
  );
}