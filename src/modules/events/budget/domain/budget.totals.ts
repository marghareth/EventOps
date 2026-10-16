// src/modules/events/budget/domain/budget.totals.ts
// Plain sums of the stored item amounts (B5-F03 estimated, B5-F04 committed, B5-F05 paid, B5-F06 allocated; D-086, D-087). Pure and exact: peso
// strings are added as whole centavos in BigInt, never as floating-point numbers (PROJECT_RULES
// section 6.1), so 0.10 + 0.20 is exactly 0.30.
//
// DELIBERATELY NOT HERE: remaining, over-budget, spent basis, statuses, and any supplier-derived
// committed amount. Those rules are not approved (D-085, BQ-06, BQ-07). Totals are calculated on
// demand and never stored (PROJECT_RULES section 6).

const toCentavos = (pesos: string): bigint => BigInt(pesos.replace(".", ""));

function fromCentavos(centavos: bigint): string {
  const digits = centavos.toString().padStart(3, "0");
  return `${digits.slice(0, -2)}.${digits.slice(-2)}`;
}

/** Adds two-place peso strings exactly. An empty list is "0.00". Inputs are never negative. */
export function sumPesos(values: readonly string[]): string {
  return fromCentavos(values.reduce((sum, value) => sum + toCentavos(value), BigInt(0)));
}

export type ItemAmounts = { estimated: string; committed: string; paid: string };
export type ItemTotals = ItemAmounts;

/** The total estimated, committed and paid of a set of items. */
export function totalsOf(items: readonly ItemAmounts[]): ItemTotals {
  return {
    estimated: sumPesos(items.map((item) => item.estimated)),
    committed: sumPesos(items.map((item) => item.committed)),
    paid: sumPesos(items.map((item) => item.paid)),
  };
}

/** The total allocated across a set of categories (D-087). */
export function totalAllocated(categories: readonly { allocation: string }[]): string {
  return sumPesos(categories.map((category) => category.allocation));
}