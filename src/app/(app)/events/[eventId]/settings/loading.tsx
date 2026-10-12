// src/app/(app)/events/[eventId]/settings/loading.tsx
// Shown while the Settings page loads (B1-05). It sits below the event layout, so the layout's
// access check still answers a refused event with a real 404 (D-027).
import { LoadingState } from "@/components/shared/LoadingState";

export default function Loading() {
  return (
    <div className="max-w-3xl rounded-xl bg-white shadow-xs">
      <LoadingState label="Loading event settings" />
    </div>
  );
}