// src/modules/events/health/ui/HealthSummaryTiles.tsx
// The dashboard's operational summaries (B8-F11; D-107): one tile per area with its main figure, each
// a link to that section. Wraps to one column on a phone.
import Link from "next/link";
import { HEALTH_AREA_LABEL } from "../domain/health-check";
import type { DashboardSummary } from "../domain/summary";

export function HealthSummaryTiles({
  summary,
  eventId,
}: {
  summary: readonly DashboardSummary[];
  eventId: string;
}) {
  return (
    <ul aria-label="Event summary" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {summary.map((tile) => (
        <li key={tile.area}>
          <Link
            href={`/events/${encodeURIComponent(eventId)}/${tile.target}`}
            className="flex h-full min-h-11 flex-col gap-1 rounded-xl bg-white p-4 shadow-xs hover:shadow-md"
          >
            <span className="text-sm font-semibold text-ink-2">{HEALTH_AREA_LABEL[tile.area]}</span>
            <span className="text-h4 font-extrabold wrap-break-word">{tile.figure}</span>
            <span className="text-xs text-ink-3">{tile.caption}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}