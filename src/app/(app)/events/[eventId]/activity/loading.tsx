// src/app/(app)/events/[eventId]/activity/loading.tsx
// Shown while Activity loads (B1-11). Below the event layout, so refused events still get a 404.
import { LoadingState } from "@/components/shared/LoadingState";

export default function Loading() {
  return (
    <div className="max-w-3xl rounded-xl bg-white shadow-xs">
      <LoadingState label="Loading activity" />
    </div>
  );
}