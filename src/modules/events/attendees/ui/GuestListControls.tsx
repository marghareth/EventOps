// src/modules/events/attendees/ui/GuestListControls.tsx
// Search, filters and sorting for the guest list (B2-10, B2-11, B2-12; D-050). A plain GET form:
// the choices go into the address, so it works without JavaScript, can be bookmarked and survives
// a reload. The chosen RSVP (set by the RSVP links) is kept in a hidden field. Fields stack in one
// column on phones. Every control has a visible label.
import Link from "next/link";
import { fieldControlClass } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_QUERY,
  SEARCH_MAX_LENGTH,
  SORT_KEYS,
  SORT_LABEL,
  type GuestListQuery,
} from "../guest-list-query";
import { rsvpFilterParam } from "../rsvp-filter";

type Props = {
  /** The guest list's address, without a query. */
  listHref: string;
  query: GuestListQuery;
  categories: readonly string[];
  /** Offer the dietary needs filter (attendees.dietary). */
  dietaryVisible: boolean;
  /** Search covers email and phone too (attendees.private). */
  contactSearch: boolean;
};

const label = "text-sm font-semibold text-ink";

function Select({
  id,
  name,
  text,
  value,
  options,
}: {
  id: string;
  name: string;
  text: string;
  value: string;
  options: readonly (readonly [string, string])[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={label}>
        {text}
      </label>
      <select id={id} name={name} defaultValue={value} className={fieldControlClass}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  );
}

export function GuestListControls({
  listHref,
  query,
  categories,
  dietaryVisible,
  contactSearch,
}: Props) {
  const changed = JSON.stringify({ ...query }) !== JSON.stringify({ ...DEFAULT_QUERY });
  return (
    <form
      method="get"
      action={listHref}
      role="search"
      aria-label="Search, filter and sort attendees"
      className="rounded-xl bg-white p-4 shadow-xs sm:p-6"
    >
      {query.rsvp ? <input type="hidden" name="rsvp" value={rsvpFilterParam(query.rsvp)} /> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
          <label htmlFor="guest-search" className={label}>
            Search attendees
          </label>
          <p id="guest-search-hint" className="text-xs text-ink-3">
            {contactSearch
              ? "Name, ID (like ATT-0008), email or phone."
              : "Name or ID (like ATT-0008)."}
          </p>
          <input
            id="guest-search"
            type="search"
            name="q"
            defaultValue={query.search ?? ""}
            maxLength={SEARCH_MAX_LENGTH}
            aria-describedby="guest-search-hint"
            autoComplete="off"
            className={fieldControlClass}
          />
        </div>
        {categories.length > 0 ? (
          <Select
            id="guest-category"
            name="category"
            text="Category"
            value={query.category ?? ""}
            options={[["", "All categories"], ...categories.map((c) => [c, c] as const)]}
          />
        ) : null}
        {dietaryVisible ? (
          <Select
            id="guest-dietary"
            name="dietary"
            text="Dietary needs"
            value={query.dietary ?? ""}
            options={[
              ["", "Any"],
              ["yes", "Recorded"],
              ["no", "Not recorded"],
            ]}
          />
        ) : null}
        <Select
          id="guest-plusones"
          name="plusones"
          text="Plus-ones"
          value={query.plusOnes ?? ""}
          options={[
            ["", "Any"],
            ["yes", "Bringing plus-ones"],
            ["no", "None"],
          ]}
        />
        <Select
          id="guest-sort"
          name="sort"
          text="Sort by"
          value={query.sort}
          options={SORT_KEYS.map((key) => [key, SORT_LABEL[key]] as const)}
        />
        <Select
          id="guest-dir"
          name="dir"
          text="Order"
          value={query.dir}
          options={[
            ["asc", "Ascending (A–Z, low to high)"],
            ["desc", "Descending (Z–A, high to low)"],
          ]}
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="submit">Apply</Button>
        {changed ? (
          <Button asChild variant="ghost">
            <Link href={listHref}>Clear all</Link>
          </Button>
        ) : null}
      </div>
    </form>
  );
}