// src/app/(app)/events/[eventId]/activity/error.tsx
// Error state for Activity (B1-11). Never shows error.message; the digest is a safe reference.
"use client";

import { ErrorState } from "@/components/shared/ErrorState";

export default function ActivityError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="max-w-3xl rounded-xl bg-white shadow-xs">
      <ErrorState
        headingLevel={1}
        title="Couldn't load activity"
        description="Something went wrong on our side. Try again in a moment."
        onRetry={reset}
        reference={error.digest}
      />
    </div>
  );
}