// src/components/shared/ErrorState.tsx
"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { StatePanel } from "./StatePanel";

type ErrorStateProps = {
  title?: string;
  /** A safe, human message. Never pass raw error.message, SQL, or stack traces. */
  description?: ReactNode;
  /** Shows a "Try again" button when provided. */
  onRetry?: () => void;
  /** Opaque support reference such as a Next.js error digest. Safe to show. */
  reference?: string;
  /** Extra actions, for example a link back to the events list. */
  children?: ReactNode;
  headingLevel?: 1 | 2 | 3;
};

export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this. Try again in a moment.",
  onRetry,
  reference,
  children,
  headingLevel,
}: ErrorStateProps) {
  return (
    <StatePanel
      icon="error"
      tone="critical"
      role="alert"
      title={title}
      description={description}
      headingLevel={headingLevel}
    >
      {onRetry ? <Button onClick={onRetry}>Try again</Button> : null}
      {children}
      {reference ? (
        <p className="basis-full font-mono text-sm text-ink-3">Reference: {reference}</p>
      ) : null}
    </StatePanel>
  );
}