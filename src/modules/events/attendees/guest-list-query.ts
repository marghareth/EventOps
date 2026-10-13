// src/modules/events/attendees/guest-list-query.ts
// Search, filters and sorting for the guest list (B2-10, B2-11, B2-12; D-050). Pure functions: the
// page applies them to the guest list the server has already authorized for the reader's role, so
// they can never show another event's attendees or a field the role may not receive. Nothing here
// changes stored data. Every value comes from the address and is checked against a fixed list (or
// this event's own categories); anything else is ignored.
import { RSVP_FILTER_ORDER, filterByRsvp, parseRsvpFilter, rsvpFilterParam } from "./rsvp-filter";
import { RSVP_LABEL, formatAttendeeReference, type RsvpStatus } from "./schema";

export const SEARCH_MAX_LENGTH = 100;

export const SORT_KEYS = ["name", "id", "rsvp", "plusones", "category"] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export type SortDirection = "asc" | "desc";

export const SORT_LABEL: Record<SortKey, string> = {
  name: "Name",
  id: "ID (order added)",
  rsvp: "RSVP",
  plusones: "Plus-ones",
  category: "Category",
};

/** Yes/no filters: "yes" = has a value, "no" = has none. */
export type Presence = "yes" | "no";

export type GuestListQuery = {
  search: string | null;
  rsvp: RsvpStatus | null;
  category: string | null;
  dietary: Presence | null;
  plusOnes: Presence | null;
  sort: SortKey;
  dir: SortDirection;
};

export const DEFAULT_QUERY: GuestListQuery = {
  search: null,
  rsvp: null,
  category: null,
  dietary: null,
  plusOnes: null,
  sort: "name",
  dir: "asc",
};

type Params = Record<string, string | string[] | undefined>;

/** What the reader may filter on: this event's categories, and dietary needs if visible. */
export type QueryContext = { categories: readonly string[]; dietaryVisible: boolean };

/** A row the functions below can work on. email and phone are present only for allowed roles. */
export type QueryableRow = {
  number: number;
  name: string;
  rsvpStatus: RsvpStatus;
  plusOnes: number;
  category: string | null;
  dietaryNeeds?: string | null;
  email?: string | null;
  phone?: string | null;
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const presence = (value: string | undefined): Presence | null =>
  value === "yes" || value === "no" ? value : null;

/** Lower case, accents removed, spaces collapsed: "  Peña " → "pena". */
export function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** The distinct categories in a guest list, sorted, each once (case-insensitively). */
export function categoriesOf(rows: readonly { category: string | null }[]): string[] {
  const byKey = new Map<string, string>();
  for (const { category } of rows) {
    if (category && !byKey.has(fold(category))) byKey.set(fold(category), category);
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
}

/** Reads the address. Unknown or malformed values fall back to "no filter" and the default sort. */
export function parseGuestListQuery(params: Params, context: QueryContext): GuestListQuery {
  const rawSearch = first(params.q);
  const search =
    typeof rawSearch === "string" && rawSearch.trim()
      ? rawSearch.trim().slice(0, SEARCH_MAX_LENGTH)
      : null;
  const rawCategory = first(params.category);
  const category =
    typeof rawCategory === "string"
      ? (context.categories.find((c) => fold(c) === fold(rawCategory)) ?? null)
      : null;
  const sort = SORT_KEYS.find((key) => key === first(params.sort)) ?? "name";
  return {
    search,
    rsvp: parseRsvpFilter(params.rsvp),
    category,
    dietary: context.dietaryVisible ? presence(first(params.dietary)) : null,
    plusOnes: presence(first(params.plusones)),
    sort,
    dir: first(params.dir) === "desc" ? "desc" : "asc",
  };
}

/** The address for a query, leaving out defaults: "?q=ana&rsvp=confirmed" or "". */
export function guestListQueryString(query: GuestListQuery): string {
  const params = new URLSearchParams();
  if (query.search) params.set("q", query.search);
  if (query.rsvp) params.set("rsvp", rsvpFilterParam(query.rsvp));
  if (query.category) params.set("category", query.category);
  if (query.dietary) params.set("dietary", query.dietary);
  if (query.plusOnes) params.set("plusones", query.plusOnes);
  if (query.sort !== "name") params.set("sort", query.sort);
  if (query.dir !== "asc") params.set("dir", query.dir);
  const text = params.toString();
  return text ? `?${text}` : "";
}

/** True when search or any filter narrows the list (sorting alone does not). */
export function isNarrowed(query: GuestListQuery): boolean {
  return Boolean(query.search || query.rsvp || query.category || query.dietary || query.plusOnes);
}

/** Search or filters other than RSVP are active. */
export function hasCriteriaBeyondRsvp(query: GuestListQuery): boolean {
  return Boolean(query.search || query.category || query.dietary || query.plusOnes);
}

/** The active search and filters in words, for the empty state. */
export function describeCriteria(query: GuestListQuery): string[] {
  const parts: string[] = [];
  if (query.search) parts.push(`Search: “${query.search}”`);
  if (query.rsvp) parts.push(`RSVP: ${RSVP_LABEL[query.rsvp]}`);
  if (query.category) parts.push(`Category: ${query.category}`);
  if (query.dietary)
    parts.push(query.dietary === "yes" ? "Dietary needs recorded" : "No dietary needs recorded");
  if (query.plusOnes) parts.push(query.plusOnes === "yes" ? "Bringing plus-ones" : "No plus-ones");
  return parts;
}

const ID_SEARCH = /^(?:att-?)?0*(\d{1,9})$/i;
const PHONE_SEARCH = /^[\d\s()+-]+$/;
const digits = (text: string) => text.replace(/\D/g, "");

/**
 * Whether a row matches the search text. Name: partial, ignoring case and accents. ID: "ATT-0008",
 * "att8" or "8" find number 8 exactly. Email and phone: only when the row carries them, which it
 * does only for roles with attendees.private (D-048); phone compares digits only.
 */
export function matchesSearch(row: QueryableRow, search: string): boolean {
  const needle = fold(search);
  if (!needle) return true;
  if (fold(row.name).includes(needle)) return true;
  const id = ID_SEARCH.exec(needle.replace(/\s/g, ""));
  if (id && Number(id[1]) === row.number) return true;
  // A partial reference like "att-00" finds every ID that starts that way; bare digits don't, so
  // "8" finds ATT-0008 only, not ATT-0018.
  if (needle.startsWith("att") && fold(formatAttendeeReference(row.number)).startsWith(needle)) {
    return true;
  }
  if (row.email && fold(row.email).includes(needle)) return true;
  if (row.phone && PHONE_SEARCH.test(needle) && digits(needle).length >= 3) {
    if (digits(row.phone).includes(digits(needle))) return true;
  }
  return false;
}

const hasText = (value: string | null | undefined) => Boolean(value && value.trim());

/** Search and every filter, combined with AND. Keeps the input order. */
export function filterGuestList<T extends QueryableRow>(
  rows: readonly T[],
  query: GuestListQuery,
): T[] {
  return filterByRsvp(rows, query.rsvp).filter(
    (row) =>
      (!query.search || matchesSearch(row, query.search)) &&
      (!query.category || (row.category !== null && fold(row.category) === fold(query.category))) &&
      (!query.dietary || hasText(row.dietaryNeeds) === (query.dietary === "yes")) &&
      (!query.plusOnes || row.plusOnes > 0 === (query.plusOnes === "yes")),
  );
}

const RSVP_RANK = new Map<RsvpStatus, number>(RSVP_FILTER_ORDER.map((s, i) => [s, i]));
const byName = (a: QueryableRow, b: QueryableRow) =>
  a.name.localeCompare(b.name, "en", { sensitivity: "base" }) || a.number - b.number;

/**
 * A sorted copy. Ties are broken by name, then ID, always ascending, so the order never jumps.
 * Attendees without a category come last in both directions.
 */
export function sortGuestList<T extends QueryableRow>(
  rows: readonly T[],
  sort: SortKey,
  dir: SortDirection,
): T[] {
  const sign = dir === "desc" ? -1 : 1;
  const compare = (a: T, b: T): number => {
    switch (sort) {
      case "name":
        return sign * byName(a, b);
      case "id":
        return sign * (a.number - b.number);
      case "rsvp":
        return sign * (RSVP_RANK.get(a.rsvpStatus)! - RSVP_RANK.get(b.rsvpStatus)!) || byName(a, b);
      case "plusones":
        return sign * (a.plusOnes - b.plusOnes) || byName(a, b);
      case "category":
        if (a.category === null || b.category === null) {
          return (a.category === null ? 1 : 0) - (b.category === null ? 1 : 0) || byName(a, b);
        }
        return (
          sign * a.category.localeCompare(b.category, "en", { sensitivity: "base" }) || byName(a, b)
        );
      default: {
        const unreachable: never = sort;
        return unreachable;
      }
    }
  };
  return [...rows].sort(compare);
}

/** Search, filters, then sorting. */
export function applyGuestListQuery<T extends QueryableRow>(
  rows: readonly T[],
  query: GuestListQuery,
): T[] {
  return sortGuestList(filterGuestList(rows, query), query.sort, query.dir);
}