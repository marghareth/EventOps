// src/modules/events/attendees/ui/RsvpFilter.tsx
// Filter the guest list by RSVP (B2-08, D-049): plain links that keep the choice in the address
// (?rsvp=confirmed), so they work without JavaScript and can be bookmarked. Each shows its count
// in text; the current one is marked with aria-current, not by color alone.
import Link from "next/link";
import { cn } from "@/lib/utils";
import { RSVP_FILTER_ORDER, rsvpFilterParam } from "../rsvp-filter";
import { RSVP_LABEL, type RsvpStatus } from "../schema";

type Props = {
  /** The guest list's address, without a filter. */
  baseHref: string;
  current: RsvpStatus | null;
  counts: Record<RsvpStatus, number>;
  total: number;
};

const item =
  "inline-flex min-h-11 items-center gap-1.5 rounded-full border-[1.5px] px-4 font-display text-sm font-bold transition-colors duration-150";
const idle = "border-line bg-white text-ink hover:bg-mist";
const active = "border-ink bg-ink text-white";

export function RsvpFilter({ baseHref, current, counts, total }: Props) {
  const options: { key: string; label: string; count: number; href: string; on: boolean }[] = [
    { key: "all", label: "All", count: total, href: baseHref, on: current === null },
    ...RSVP_FILTER_ORDER.map((status) => ({
      key: status,
      label: RSVP_LABEL[status],
      count: counts[status],
      href: `${baseHref}?rsvp=${rsvpFilterParam(status)}`,
      on: current === status,
    })),
  ];
  return (
    <nav aria-label="Filter by RSVP">
      <ul className="flex flex-wrap gap-2">
        {options.map((option) => (
          <li key={option.key}>
            <Link
              href={option.href}
              aria-current={option.on ? "true" : undefined}
              className={cn(item, option.on ? active : idle)}
            >
              {option.label}{" "}
              <span className="font-sans font-medium tabular-nums">({option.count})</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}