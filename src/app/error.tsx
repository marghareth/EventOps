// src/app/error.tsx
"use client";

import { ErrorState } from "@/components/shared/ErrorState";

// Never render error.message: it can contain internal details. The digest is a safe reference.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="rounded-xl bg-white shadow-sm">
        <ErrorState
          headingLevel={1}
          description="We couldn't load this page. Try again."
          onRetry={reset}
          reference={error.digest}
        />
      </div>
    </main>
  );
}