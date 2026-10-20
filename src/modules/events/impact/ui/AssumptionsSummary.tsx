// src/modules/events/impact/ui/AssumptionsSummary.tsx
// The impact assumptions, read-only, for members who can't edit them (B7-F12, D-102). Pesos are
// shown with the budget's own formatter.
import { formatPesos } from "@/modules/events/budget/public";
import { ASSUMPTION_LABEL, formatRatio } from "../domain/assumptions";

export function AssumptionsSummary({
  cateringCostPerHead,
  accessibleSeatsPer100,
  cateringCategoryName,
}: {
  cateringCostPerHead: string | null;
  accessibleSeatsPer100: string | null;
  cateringCategoryName: string | null;
}) {
  const rows: [string, string][] = [
    [
      ASSUMPTION_LABEL.cateringCostPerHead,
      cateringCostPerHead ? formatPesos(cateringCostPerHead) : "Not set",
    ],
    [
      ASSUMPTION_LABEL.accessibleSeatsPer100,
      accessibleSeatsPer100 ? formatRatio(accessibleSeatsPer100) : "Not set",
    ],
    [ASSUMPTION_LABEL.cateringCategoryId, cateringCategoryName ?? "Not set"],
  ];
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-white p-5 text-sm shadow-xs">
      <dl className="flex flex-col gap-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-col sm:flex-row sm:gap-2">
            <dt className="text-ink-3">{label}:</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-ink-2">Owners and Coordinators can change these.</p>
    </div>
  );
}