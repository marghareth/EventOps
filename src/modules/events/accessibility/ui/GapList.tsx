// src/modules/events/accessibility/ui/GapList.tsx
// What is missing (B3-10, D-064): each gap as a plain sentence, what it means for readiness, the
// guests and needs it affects (linked to their pages) and, for managers, a link to fix the
// resource. Built only from the server's gap results; nothing is decided here.
import Link from "next/link";
import { GAP_CONSEQUENCE_TEXT, guestReference, type Gap } from "../domain/gaps";
import {
  REQUIREMENT_PRIORITY_DEFINITIONS,
  REQUIREMENT_TYPE_DEFINITIONS,
} from "../domain/requirement-type";
import { RESOURCE_TYPE_DEFINITIONS, resourceSlug } from "../domain/resource";
import type { ReadinessStatus } from "../domain/readiness-status";

type Props = {
  gaps: Gap[];
  status: ReadinessStatus;
  /** The Accessibility page, for resource links. */
  basePath: string;
  /** The guest list, for guest links. */
  attendeesPath: string;
  canManage: boolean;
};

const CONSEQUENCE_STYLE = {
  "not-ready": "border-critical-line bg-critical-tint text-critical",
  "almost-ready": "border-warning-line bg-warning-tint text-warning",
  advice: "border-line bg-mist text-ink",
} as const;

export function GapList({ gaps, status, basePath, attendeesPath, canManage }: Props) {
  return (
    <section aria-labelledby="gaps-heading" className="rounded-xl bg-white p-6 shadow-xs sm:p-8">
      <h2 id="gaps-heading" className="text-h4 font-bold">
        What&apos;s missing
      </h2>
      {gaps.length === 0 ? (
        <p className="mt-3 text-ink-2">
          {status === "NO_REQUIRED_NEEDS"
            ? "Nothing to check yet: no guest who is coming has a Required need."
            : "Nothing is missing. Every need is covered."}
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-4">
          {gaps.map((gap) => {
            const fix =
              gap.resource && canManage
                ? {
                    href: `${basePath}/${resourceSlug(gap.resource)}/edit`,
                    label: `${gap.kind === "not-set-up" ? "Set up" : "Edit"} ${RESOURCE_TYPE_DEFINITIONS[gap.resource].label}`,
                  }
                : null;
            return (
              <li key={gap.key} className="rounded-lg border border-line p-4">
                <h3 className="font-semibold text-ink">{gap.summary}</h3>
                <p
                  className={`mt-2 inline-flex rounded-sm border px-2.5 py-1 text-[13px] font-medium ${CONSEQUENCE_STYLE[gap.consequence]}`}
                >
                  {GAP_CONSEQUENCE_TEXT[gap.consequence]}
                </p>
                {gap.seats ? (
                  <p className="mt-2 text-sm text-ink-2">
                    Seats available: {gap.seats.available} · Required seating needs:{" "}
                    {gap.seats.required} · Preferred seating needs: {gap.seats.preferred}
                  </p>
                ) : null}
                <p className="mt-3 text-sm font-semibold text-ink-2">Affects</p>
                <ul className="mt-1 flex flex-col gap-1 text-sm">
                  {gap.requirements.map((requirement) => (
                    <li key={requirement.id}>
                      <Link
                        href={`${attendeesPath}/${requirement.attendee.id}`}
                        className="text-blue underline-offset-2 hover:underline"
                      >
                        {requirement.attendee.name} ({guestReference(requirement.attendee.number)})
                      </Link>
                      {": "}
                      {REQUIREMENT_TYPE_DEFINITIONS[requirement.type].label},{" "}
                      {REQUIREMENT_PRIORITY_DEFINITIONS[requirement.priority].label}
                    </li>
                  ))}
                </ul>
                {fix ? (
                  <p className="mt-3">
                    <Link
                      href={fix.href}
                      className="text-sm font-semibold text-blue underline-offset-2 hover:underline"
                    >
                      {fix.label}
                    </Link>
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}