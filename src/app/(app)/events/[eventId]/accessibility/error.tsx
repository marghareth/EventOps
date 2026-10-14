// src/app/(app)/events/[eventId]/accessibility/error.tsx
// Error state for the Accessibility page and the resource forms below it (B3-06, D-040). The
// sidebar and event header stay. Never shows error.message, which can contain internal details;
// the digest is a safe reference. Try again fetches fresh server data before re-rendering.
"use client";

import { ErrorState } from "@/components/shared/ErrorState";
import { useRetry } from "@/components/shared/use-retry";

export default function AccessibilityError({
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
        title="Couldn't load accessibility"
        description="Something went wrong on our side. Try again in a moment."
        onRetry={retry}
        reference={error.digest}
      />
    </div>
  );
}