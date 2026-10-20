// src/modules/events/impact/ui/ImpactList.tsx
// The identified impacts as cards (B7-F09, B7-F10, B7-F18; D-101): area, severity (icon and word),
// what may happen, why, whether it is an estimate, the assumptions it used, the records involved and
// where to act. One markup for every width: a single column, so nothing scrolls sideways.
import Link from "next/link";
import { IMPACT_AREA_LABEL, type ImpactFixTarget, type ImpactItem } from "../domain/impact-item";
import { ImpactSeverityBadge } from "./ImpactSeverityBadge";

/** Where each fix goes, relative to the event. "assumptions" is the section on this page. */
export function fixHref(eventId: string, target: ImpactFixTarget): string {
  const base = `/events/${encodeURIComponent(eventId)}`;
  return target === "assumptions" ? "#assumptions" : `${base}/${target}`;
}

export function ImpactList({
  items,
  eventId,
  headingLevel = 3,
  label = "Identified impacts",
}: {
  items: readonly ImpactItem[];
  eventId: string;
  headingLevel?: 3 | 4;
  label?: string;
}) {
  const Heading = headingLevel === 3 ? "h3" : "h4";
  return (
    <ul aria-label={label} className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.key} className="flex flex-col gap-2 rounded-xl bg-white p-5 shadow-xs">
          <div className="flex flex-wrap items-center gap-2">
            <ImpactSeverityBadge severity={item.severity} />
            <span className="text-sm font-semibold text-ink-2">{IMPACT_AREA_LABEL[item.area]}</span>
            <span className="rounded-sm border border-line bg-mist px-2 py-0.5 text-xs text-ink-2">
              {item.basis === "ESTIMATE" ? "Estimate" : "From your records"}
            </span>
          </div>
          <Heading className="text-h4 font-bold wrap-break-word">{item.title}</Heading>
          <p className="text-sm wrap-break-word text-ink-2">{item.reason}</p>
          {item.assumptions.length > 0 ? (
            <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              {item.assumptions.map((assumption) => (
                <div key={assumption.label} className="flex gap-1.5">
                  <dt className="text-ink-3">{assumption.label}:</dt>
                  <dd className="font-medium">{assumption.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {item.references.length > 0 ? (
            <p className="text-sm text-ink-2">
              <span className="sr-only">Records involved: </span>
              {item.references.map((reference) => (
                <span key={reference} className="mr-2 font-mono">
                  {reference}
                </span>
              ))}
            </p>
          ) : null}
          {item.fix ? (
            <p>
              <Link
                href={fixHref(eventId, item.fix.target)}
                className="inline-flex min-h-11 items-center text-sm font-semibold text-blue underline underline-offset-2"
              >
                {item.fix.label}
              </Link>
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}