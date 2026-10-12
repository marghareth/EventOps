// src/app/(app)/events/(list)/error.tsx
// Error state for My events (B1-03). Renders inside the app shell. Never shows error.message,
// which can contain internal details; the digest is a safe reference.
"use client";

import { ErrorState } from "@/components/shared/ErrorState";
import { useRetry } from "@/components/shared/use-retry";

export default function EventsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const retry = useRetry(reset);
  return (
    <div className="rounded-xl bg-white shadow-xs">
      <ErrorState
        headingLevel={1}
        title="Couldn't load your events"
        description="Something went wrong on our side. Try again in a moment."
        onRetry={retry}
        reference={error.digest}
      />
    </div>
  );
}