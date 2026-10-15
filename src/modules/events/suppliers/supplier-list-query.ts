// src/modules/events/suppliers/supplier-list-query.ts
// Search (B4-17, D-082) and filters (B4-18, D-083) for the supplier list. Pure functions: the read
// applies them on the server to the suppliers it has already authorized and loaded for this event
// only, so neither can reach another event's suppliers. The search text is only compared with
// stored text, and every filter value must be one of a fixed list; nothing from the address builds
// a database query. Unknown or malformed values are ignored.
import {
  SUPPLIER_CATEGORIES,
  SUPPLIER_CATEGORY_DEFINITIONS,
  type SupplierCategory,
} from "./categories";
import {
  SUPPLIER_PAYMENT_STATUSES,
  SUPPLIER_PAYMENT_STATUS_DEFINITIONS,
  type SupplierPaymentStatus,
} from "./payment-status";

export const SUPPLIER_SEARCH_MAX_LENGTH = 100;

/**
 * Where a supplier's quotes stand, as one value per supplier (D-083): it has an Accepted quote; none
 * is accepted but at least one is Pending; or none is accepted or pending (no quotes, or only
 * Declined ones). Every supplier is in exactly one.
 */
export const QUOTE_FILTERS = ["accepted", "pending", "none"] as const;
export type QuoteFilter = (typeof QUOTE_FILTERS)[number];

export const QUOTE_FILTER_LABEL: Record<QuoteFilter, string> = {
  accepted: "Quote accepted",
  pending: "Pending only",
  none: "No accepted or pending quote",
};

/** Payment statuses as written in the address: "partially-paid" for PARTIALLY_PAID. */
const paymentParam = (status: SupplierPaymentStatus) => status.toLowerCase().replace(/_/g, "-");

export type SupplierListQuery = {
  /** Cleaned search text, or null for no search. */
  search: string | null;
  category: SupplierCategory | null;
  quote: QuoteFilter | null;
  payment: SupplierPaymentStatus | null;
  /** Only suppliers with an overdue payment (D-079). */
  overdue: boolean;
};

export const DEFAULT_SUPPLIER_QUERY: SupplierListQuery = {
  search: null,
  category: null,
  quote: null,
  payment: null,
  overdue: false,
};

type Params = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * Lower case, accents removed, spaces collapsed: "  Peña " → "pena". The guest list folds text the
 * same way (attendees/guest-list-query.ts); suppliers keep their own copy so the two contexts stay
 * independent (D-001).
 */
export function foldText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The search text from the address: control characters (including NUL) removed, trimmed, at most
 * 100 characters. Empty or missing means no search; a list of values uses the first.
 */
export function cleanSupplierSearch(value: string | string[] | undefined): string | null {
  const raw = first(value);
  if (typeof raw !== "string") return null;
  const text = Array.from(raw.replace(/[\u0000-\u001f\u007f]/g, " ").trim())
    .slice(0, SUPPLIER_SEARCH_MAX_LENGTH)
    .join("")
    .trim();
  return text === "" ? null : text;
}

/** Reads the address. Anything unknown or malformed is ignored (no filter). */
export function parseSupplierListQuery(params: Params): SupplierListQuery {
  const category = first(params.category);
  const quote = first(params.quote);
  const payment = first(params.payment);
  return {
    search: cleanSupplierSearch(params.q),
    category: SUPPLIER_CATEGORIES.find((c) => c === category) ?? null,
    quote: QUOTE_FILTERS.find((q) => q === quote) ?? null,
    payment: SUPPLIER_PAYMENT_STATUSES.find((p) => paymentParam(p) === payment) ?? null,
    overdue: first(params.overdue) === "yes",
  };
}

/** The address for a query, leaving out what isn't set: "?q=bloom&payment=unpaid" or "". */
export function supplierListQueryString(query: SupplierListQuery): string {
  const params = new URLSearchParams();
  if (query.search) params.set("q", query.search);
  if (query.category) params.set("category", query.category);
  if (query.quote) params.set("quote", query.quote);
  if (query.payment) params.set("payment", paymentParam(query.payment));
  if (query.overdue) params.set("overdue", "yes");
  const text = params.toString();
  return text ? `?${text}` : "";
}

/** The payment status options for the filter, as address values and labels. */
export const PAYMENT_FILTER_OPTIONS = SUPPLIER_PAYMENT_STATUSES.map((status) => ({
  value: paymentParam(status),
  label: SUPPLIER_PAYMENT_STATUS_DEFINITIONS[status].label,
}));

/** What a supplier offers to the search. */
export type SearchableSupplier = {
  number: number;
  name: string;
  contactName: string | null;
  /** What an Other supplier provides, for example "Fireworks". */
  categoryDetail: string | null;
};

const ID_SEARCH = /^(?:sup-?)?0*(\d{1,9})$/;

/**
 * Whether a supplier matches the search text (D-082). Name, contact person and what an Other
 * supplier provides: partial, ignoring case and accents. Readable ID: "SUP-0004", "sup4" or "4"
 * find number 4 exactly; a partial reference like "sup-00" finds every ID that starts that way.
 * Email, phone and notes are not searched.
 */
export function matchesSupplierSearch(supplier: SearchableSupplier, search: string): boolean {
  const needle = foldText(search);
  if (!needle) return true;
  for (const text of [supplier.name, supplier.contactName, supplier.categoryDetail]) {
    if (text && foldText(text).includes(needle)) return true;
  }
  const compact = needle.replace(/\s/g, "");
  const id = ID_SEARCH.exec(compact);
  if (id && Number(id[1]) === supplier.number) return true;
  const reference = `sup-${String(supplier.number).padStart(4, "0")}`;
  return compact.startsWith("sup") && reference.startsWith(compact);
}

/** What the filters read about a supplier: its category and its money overview (D-081). */
export type FilterableSupplier = SearchableSupplier & {
  category: SupplierCategory;
  overview: {
    acceptedQuote: string | null;
    pendingQuotes: number;
    paymentStatus: SupplierPaymentStatus;
    due: { overdueCount: number };
  };
};

/** Which quote filter a supplier falls in (D-083). */
export function quoteFilterOf(overview: FilterableSupplier["overview"]): QuoteFilter {
  if (overview.acceptedQuote !== null) return "accepted";
  return overview.pendingQuotes > 0 ? "pending" : "none";
}

/** The suppliers matching the search and every filter (combined with AND), in the given order. */
export function filterSuppliers<T extends FilterableSupplier>(
  suppliers: readonly T[],
  query: SupplierListQuery,
): T[] {
  return suppliers.filter(
    (supplier) =>
      (!query.search || matchesSupplierSearch(supplier, query.search)) &&
      (!query.category || supplier.category === query.category) &&
      (!query.quote || quoteFilterOf(supplier.overview) === query.quote) &&
      (!query.payment || supplier.overview.paymentStatus === query.payment) &&
      (!query.overdue || supplier.overview.due.overdueCount > 0),
  );
}

/** True when the search or any filter narrows the list. */
export function isSupplierListNarrowed(query: SupplierListQuery): boolean {
  return Boolean(query.search || query.category || query.quote || query.payment || query.overdue);
}

/** The active search and filters in words, for the empty state. */
export function describeSupplierQuery(query: SupplierListQuery): string[] {
  const parts: string[] = [];
  if (query.search) parts.push(`Search: “${query.search}”`);
  if (query.category)
    parts.push(`Category: ${SUPPLIER_CATEGORY_DEFINITIONS[query.category].label}`);
  if (query.quote) parts.push(`Quote: ${QUOTE_FILTER_LABEL[query.quote]}`);
  if (query.payment) {
    parts.push(`Payment: ${SUPPLIER_PAYMENT_STATUS_DEFINITIONS[query.payment].label}`);
  }
  if (query.overdue) parts.push("Overdue payments only");
  return parts;
}