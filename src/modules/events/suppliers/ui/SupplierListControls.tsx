// src/modules/events/suppliers/ui/SupplierListControls.tsx
// Search (B4-17, D-082) and filters (B4-18, D-083) for the supplier list. A plain GET form: the
// search and filters go into the address (?q=...&category=...), so they work without JavaScript,
// survive refresh and back on any device, and can be shared. The page reads them back through
// parseSupplierListQuery and the server does the matching. On narrow screens the fields stack in
// one column with 44 px controls; nothing scrolls sideways.
import Link from "next/link";
import { fieldControlClass } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";
import { SUPPLIER_CATEGORIES, SUPPLIER_CATEGORY_DEFINITIONS } from "../categories";
import {
  PAYMENT_FILTER_OPTIONS,
  QUOTE_FILTERS,
  QUOTE_FILTER_LABEL,
  SUPPLIER_SEARCH_MAX_LENGTH,
  supplierListQueryString,
  type SupplierListQuery,
} from "../supplier-list-query";

type Props = {
  query: SupplierListQuery;
  /** The supplier list without any search or filter, for "Clear". */
  listHref: string;
  narrowed: boolean;
};

const labelClass = "text-sm font-semibold";

export function SupplierListControls({ query, listHref, narrowed }: Props) {
  const payment = new URLSearchParams(supplierListQueryString(query)).get("payment") ?? "";
  return (
    <form
      method="get"
      action={listHref}
      role="search"
      aria-label="Find suppliers"
      className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow-xs sm:p-5"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="supplier-search" className={labelClass}>
          Search suppliers
        </label>
        <p id="supplier-search-hint" className="text-xs text-ink-3">
          Name, contact person, what they provide, or ID like SUP-0004.
        </p>
        <input
          id="supplier-search"
          name="q"
          type="search"
          autoComplete="off"
          maxLength={SUPPLIER_SEARCH_MAX_LENGTH}
          defaultValue={query.search ?? ""}
          aria-describedby="supplier-search-hint"
          className={fieldControlClass}
        />
      </div>

      <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="sr-only">Filters</legend>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="supplier-filter-category" className={labelClass}>
            Category
          </label>
          <select
            id="supplier-filter-category"
            name="category"
            defaultValue={query.category ?? ""}
            className={fieldControlClass}
          >
            <option value="">All categories</option>
            {SUPPLIER_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {SUPPLIER_CATEGORY_DEFINITIONS[category].label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="supplier-filter-quote" className={labelClass}>
            Quote
          </label>
          <select
            id="supplier-filter-quote"
            name="quote"
            defaultValue={query.quote ?? ""}
            className={fieldControlClass}
          >
            <option value="">Any quote</option>
            {QUOTE_FILTERS.map((quote) => (
              <option key={quote} value={quote}>
                {QUOTE_FILTER_LABEL[quote]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="supplier-filter-payment" className={labelClass}>
            Payment status
          </label>
          <select
            id="supplier-filter-payment"
            name="payment"
            defaultValue={payment}
            className={fieldControlClass}
          >
            <option value="">Any payment status</option>
            {PAYMENT_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm sm:col-span-2 lg:col-span-3">
          <input
            type="checkbox"
            name="overdue"
            value="yes"
            defaultChecked={query.overdue}
            className="size-5 shrink-0 cursor-pointer accent-blue"
          />
          Only suppliers with an overdue payment
        </label>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit">Apply</Button>
        {narrowed ? (
          <Button asChild variant="ghost">
            <Link href={listHref}>Clear search and filters</Link>
          </Button>
        ) : null}
      </div>
    </form>
  );
}