// src/components/shared/Banner.tsx
"use client";

import type { AriaRole, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StateIcon, type StateIconName } from "./StateIcon";

export type BannerSeverity = "success" | "critical" | "warning" | "info";

// Design system "inline banner": a tinted icon box, a title, optional text and actions.
// Severity is never color alone: every banner has an icon and a hidden label before the title.
const SEVERITY: Record<BannerSeverity, { icon: StateIconName; box: string; label: string }> = {
  success: {
    icon: "success",
    box: "border-success-line bg-success-tint text-success",
    label: "Success",
  },
  critical: {
    icon: "error",
    box: "border-critical-line bg-critical-tint text-critical",
    label: "Error",
  },
  warning: {
    icon: "warning",
    box: "border-warning-line bg-warning-tint text-warning",
    label: "Warning",
  },
  info: { icon: "info", box: "border-info-line bg-info-tint text-info", label: "Information" },
};

type BannerProps = {
  severity: BannerSeverity;
  /** Say what happened, for example "Import complete". */
  title: string;
  /** Detail, for example "184 guests were added to EVT-2026-0001." */
  children?: ReactNode;
  /** One next step: a Button or a Link. */
  action?: ReactNode;
  /** Shows a "Dismiss" button when provided. */
  onDismiss?: () => void;
  /** Critical banners default to "alert" (interrupts). The rest default to "status" (polite). */
  role?: AriaRole;
  className?: string;
};

export function Banner({
  severity,
  title,
  children,
  action,
  onDismiss,
  role,
  className,
}: BannerProps) {
  const style = SEVERITY[severity];
  return (
    <div
      role={role ?? (severity === "critical" ? "alert" : "status")}
      className={cn(
        "flex w-full items-start gap-4 rounded-xl border border-line bg-mist p-4 text-ink",
        className,
      )}
    >
      <div
        className={cn(
          "flex size-14 shrink-0 items-center justify-center rounded-lg border",
          style.box,
        )}
      >
        <StateIcon name={style.icon} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          <span className="sr-only">{style.label}: </span>
          {title}
        </p>
        {children ? <div className="mt-0.5 text-sm text-ink-2">{children}</div> : null}
        {action || onDismiss ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {action}
            {onDismiss ? (
              <Button variant="ghost" size="sm" onClick={onDismiss}>
                Dismiss
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}