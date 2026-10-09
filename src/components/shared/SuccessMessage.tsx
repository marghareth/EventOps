// src/components/shared/SuccessMessage.tsx
"use client";

import type { ReactNode } from "react";
import { Banner } from "./Banner";

type SuccessMessageProps = {
  /** Say what happened, for example "Supplier saved". */
  title: string;
  /** Optional detail line. */
  children?: ReactNode;
  /** One next step, for example a link to review the result. */
  action?: ReactNode;
  /** Shows a "Dismiss" button when provided. */
  onDismiss?: () => void;
  className?: string;
};

// A polite live region (role="status"). It never times out: auto-dismissing messages can vanish
// before a screen reader or a slow reader gets to them. The user dismisses it.
export function SuccessMessage({
  title,
  children,
  action,
  onDismiss,
  className,
}: SuccessMessageProps) {
  return (
    <Banner
      severity="success"
      title={title}
      action={action}
      onDismiss={onDismiss}
      className={className}
    >
      {children}
    </Banner>
  );
}