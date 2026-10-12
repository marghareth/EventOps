// src/app/(app)/events/[eventId]/settings/error.tsx
// Error state for the Settings page (B1-05). Never shows error.message, which can contain internal
// details; the digest is a safe reference.
"use client";

import { ErrorState } from "@/components/shared/ErrorState";
import { useRetry } from "@/components/shared/use-retry";

export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const retry = useRetry(reset);
  return (
    <div className="max-w-3xl rounded-xl bg-white shadow-xs">
      <ErrorState
        headingLevel={1}
        title="Couldn't load event settings"
        description="Something went wrong on our side. Try again in a moment."
        onRetry={retry}
        reference={error.digest}
      />
    </div>
  );
}