// src/modules/events/impact/ui/ImpactSummary.tsx
// The consolidated result (B7-F10, B7-F17; D-101): the change, the overall severity and how many
// impacts of each severity, with a plain statement that this is a simulation. Counts are words with
// numbers, never colour alone; the region is announced politely when it appears.
import Link from "next/link";
import { describeChange } from "../domain/change-event";
import {
  IMPACT_SEVERITIES,
  IMPACT_SEVERITY_LABEL,
  type ImpactSeverity,
} from "../domain/impact-item";
import type { ImpactResult } from "../domain/run-impact";
import { ImpactSeverityBadge } from "./ImpactSeverityBadge";

const HEADLINE: Record<ImpactSeverity, string> = {
  CRITICAL: "This change has critical impacts",
  NEEDS_ATTENTION: "This change needs attention",
  INFO: "No problems found, with notes",
  PASSED: "No impacts found",
};

export function ImpactSummary({ result, eventId }: { result: ImpactResult; eventId: string }) {
  const settings = `/events/${encodeURIComponent(eventId)}/settings`;
  if (result.noChange || result.overall === null) {
    return (
      <div role="status" className="rounded-xl bg-white p-5 shadow-xs">
        <p className="font-semibold">Nothing to analyze</p>
        <p className="mt-1 text-sm text-ink-2">
          {result.change.to.toLocaleString("en-US")} is already the expected attendance. Enter a
          different number to see what it would affect.
        </p>
      </div>
    );
  }
  return (
    <div role="status" className="flex flex-col gap-3 rounded-xl bg-white p-5 shadow-xs">
      <div className="flex flex-wrap items-center gap-3">
        <ImpactSeverityBadge severity={result.overall} />
        <p className="text-h4 font-bold">{HEADLINE[result.overall]}</p>
      </div>
      <p className="text-sm">
        Expected attendees <span className="font-semibold">{describeChange(result.change)}</span>
      </p>
      <ul aria-label="Impacts by severity" className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {IMPACT_SEVERITIES.map((severity) => (
          <li key={severity}>
            <span className="font-semibold">{result.counts[severity]}</span>{" "}
            {IMPACT_SEVERITY_LABEL[severity]}
          </li>
        ))}
      </ul>
      <p className="text-sm text-ink-2">
        This is a simulation: nothing about the event has changed. To apply it, change the expected
        attendees in{" "}
        <Link href={settings} className="text-blue underline underline-offset-2">
          Settings
        </Link>
        .
      </p>
    </div>
  );
}