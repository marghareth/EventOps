// src/modules/events/impact/ui/ImpactHistory.tsx
// Saved analyses, newest first (B7-F11; D-103). Each one is shown exactly as it was saved, with the
// assumptions it used, and labelled as a simulation so it is never read as something that happened.
// Native <details> keeps it keyboard and screen-reader friendly with no script.
import { formatPesos } from "@/modules/events/budget/public";
import { formatRatio } from "../domain/assumptions";
import { ImpactList } from "./ImpactList";
import { ImpactSeverityBadge } from "./ImpactSeverityBadge";

const WHEN = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Manila",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export type ImpactHistoryEntry = {
  reference: string;
  createdAt: Date;
  createdByName: string | null;
  snapshot: {
    from: number;
    to: number;
    overall: "CRITICAL" | "NEEDS_ATTENTION" | "INFO" | "PASSED";
    assumptions: {
      cateringCostPerHead: string | null;
      accessibleSeatsPer100: string | null;
      cateringCategory: string | null;
    };
    items: Parameters<typeof ImpactList>[0]["items"];
  };
};

const count = (n: number) => n.toLocaleString("en-US");

export function ImpactHistory({
  entries,
  eventId,
}: {
  entries: readonly ImpactHistoryEntry[];
  eventId: string;
}) {
  return (
    <ul aria-label="Saved analyses" className="flex flex-col gap-3">
      {entries.map((entry) => {
        const { snapshot } = entry;
        const assumptions = [
          `Cost per head: ${snapshot.assumptions.cateringCostPerHead ? formatPesos(snapshot.assumptions.cateringCostPerHead) : "not set"}`,
          `Accessible seats per 100: ${snapshot.assumptions.accessibleSeatsPer100 ? formatRatio(snapshot.assumptions.accessibleSeatsPer100) : "not set"}`,
          `Catering category: ${snapshot.assumptions.cateringCategory ?? "not set"}`,
        ];
        return (
          <li key={entry.reference} className="rounded-xl bg-white shadow-xs">
            <details className="group">
              <summary className="flex min-h-11 cursor-pointer flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
                <span className="flex flex-col gap-1">
                  <span className="font-mono text-sm text-ink-2">{entry.reference}</span>
                  <span className="font-semibold">
                    Expected attendees {count(snapshot.from)} → {count(snapshot.to)}
                  </span>
                  <span className="text-sm text-ink-2">
                    Saved {WHEN.format(entry.createdAt)} PHT
                    {entry.createdByName ? ` by ${entry.createdByName}` : ""}. Simulation: not a
                    change to the event.
                  </span>
                </span>
                <ImpactSeverityBadge severity={snapshot.overall} className="self-start" />
              </summary>
              <div className="flex flex-col gap-3 border-t border-line p-5">
                <p className="text-sm text-ink-2">{assumptions.join(" · ")}</p>
                <ImpactList
                  items={snapshot.items}
                  eventId={eventId}
                  headingLevel={4}
                  label={`Impacts in ${entry.reference}`}
                />
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}