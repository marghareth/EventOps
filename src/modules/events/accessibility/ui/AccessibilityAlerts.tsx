// src/modules/events/accessibility/ui/AccessibilityAlerts.tsx
// Accessibility alerts (B3-11, D-066) in the design system's inline-banner style: a tinted icon box,
// a hidden severity word (never color alone), the headline, the reason and one next step. Shown
// from the server's alerts only; nothing is decided here. They are part of the page, not live
// updates, so they don't use role="alert" (that would interrupt on every page load), and they
// can't be dismissed (D-066: nothing is stored).
import Link from "next/link";
import type { ReactNode } from "react";
import { Banner } from "@/components/shared/Banner";
import { StateIcon } from "@/components/shared/StateIcon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AccessibilityAlert, AlertSeverity } from "../domain/alerts";
import { RESOURCE_TYPE_DEFINITIONS, resourceSlug } from "../domain/resource";

const STYLE: Record<AlertSeverity, { icon: "error" | "warning"; box: string; label: string }> = {
  critical: {
    icon: "error",
    box: "border-critical-line bg-critical-tint text-critical",
    label: "Critical",
  },
  warning: {
    icon: "warning",
    box: "border-warning-line bg-warning-tint text-warning",
    label: "Needs attention",
  },
};

function AlertBanner({
  alert,
  children,
  action,
}: {
  alert: AccessibilityAlert;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const style = STYLE[alert.severity];
  return (
    <div className="flex w-full items-start gap-4 rounded-xl border border-line bg-mist p-4 text-ink">
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
          {alert.title}
        </p>
        <p className="mt-0.5 text-sm text-ink-2">{alert.reason}</p>
        {children}
        {action ? <div className="mt-3 flex flex-wrap items-center gap-2">{action}</div> : null}
      </div>
    </div>
  );
}

// The event-level alert that was on the Overview was replaced by Event Health (B8, D-107 point 4).

/** The alerts about one guest, on their page. Managers get the link to fix the resource. */
export function GuestAccessibilityAlerts({
  alerts,
  accessibilityPath,
  canManage,
}: {
  alerts: AccessibilityAlert[];
  accessibilityPath: string;
  canManage: boolean;
}) {
  if (alerts.length === 0) return null;
  return (
    <section aria-labelledby="guest-alerts-heading">
      <h2 id="guest-alerts-heading" className="sr-only">
        Alerts about this guest&apos;s needs
      </h2>
      <ul className="flex flex-col gap-3">
        {alerts.map((alert) => {
          const fix =
            alert.resource && canManage
              ? {
                  href: `${accessibilityPath}/${resourceSlug(alert.resource)}/edit`,
                  label: `${alert.gapKind === "not-set-up" ? "Set up" : "Edit"} ${RESOURCE_TYPE_DEFINITIONS[alert.resource].label}`,
                }
              : { href: accessibilityPath, label: "Review accessibility" };
          return (
            <li key={alert.key}>
              <AlertBanner
                alert={alert}
                action={
                  <Button asChild size="sm" variant="outline">
                    <Link href={fix.href}>{fix.label}</Link>
                  </Button>
                }
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** When the alerts couldn't be read: said plainly, so a missing alert is never mistaken for none. */
export function AccessibilityAlertsUnavailable() {
  return (
    <Banner severity="warning" title="We couldn't check accessibility alerts" role="status">
      Reload the page to try again.
    </Banner>
  );
}