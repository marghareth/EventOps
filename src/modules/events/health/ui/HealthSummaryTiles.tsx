// src/modules/events/health/ui/HealthSummaryTiles.tsx
// The dashboard's operational summaries (B8-F11; D-107): one tile per area with its main figure, each
// a link to that section. Bento tiles with an icon and a big figure (D-118). Wraps to one column on
// a phone.
import Link from "next/link";
import { NavIcon, type NavIconName } from "@/components/layout/NavIcon";
import { HEALTH_AREA_LABEL } from "../domain/health-check";
import type { DashboardSummary } from "../domain/summary";

/** Decorative icon chip per area (D-119); the area is also written in words. */
const AREA_ICON: Record<DashboardSummary["area"], { icon: NavIconName; chip: string }> = {
  ATTENDEES: { icon: "users", chip: "bg-violet-soft text-ink" },
  SUPPLIERS: { icon: "truck", chip: "bg-lime-soft text-ink" },
  BUDGET: { icon: "wallet", chip: "bg-ink text-lime" },
  ACCESSIBILITY: { icon: "accessibility", chip: "bg-blue-tint text-blue" },
  TASKS: { icon: "tasks", chip: "bg-lime-tint text-ink" },
};

export function HealthSummaryTiles({
  summary,
  eventId,
}: {
  summary: readonly DashboardSummary[];
  eventId: string;
}) {
  return (
    <ul
      aria-label="Event summary"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
    >
      {summary.map((tile) => (
        <li key={tile.area}>
          <Link
            href={`/events/${encodeURIComponent(eventId)}/${tile.target}`}
            className="group flex h-full min-h-11 flex-col gap-4 rounded-[28px] bg-white p-5 shadow-xs transition-shadow duration-150 hover:shadow-md"
          >
            <span className="flex items-center gap-2.5">
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-full ${AREA_ICON[tile.area].chip}`}
              >
                <NavIcon name={AREA_ICON[tile.area].icon} className="size-4.5" />
              </span>
              <span className="text-sm font-semibold text-ink-2">
                {HEALTH_AREA_LABEL[tile.area]}
              </span>
              <span className="ml-auto flex size-8 shrink-0 items-center justify-center rounded-full border border-line text-ink transition-colors group-hover:border-ink group-hover:bg-ink group-hover:text-white">
                <NavIcon name="arrow-up-right" className="size-4" />
              </span>
            </span>
            <span className="mt-auto font-display text-[26px] leading-tight font-extrabold tracking-[-0.02em] wrap-break-word">
              {tile.figure}
            </span>
            <span className="-mt-2 text-xs text-ink-3">{tile.caption}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}