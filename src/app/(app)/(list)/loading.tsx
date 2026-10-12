// src/app/(app)/events/(list)/loading.tsx
// Shown while My events loads (B1-03).
import { LoadingState } from "@/components/shared/LoadingState";

export default function Loading() {
  return (
    <div className="rounded-xl bg-white shadow-xs">
      <LoadingState label="Loading your events" />
    </div>
  );
}