// src/modules/events/impact/domain/rules/catering-cost.ts
// Catering cost impact (B7-F03; D-101 point 2, D-102). Estimate only:
//
//   change = (proposed − current expected attendees) × catering cost per head
//
// in whole centavos (BigInt), never floating point. No cost per head set → Info, nothing guessed.
// An increase is Needs attention (the budget rule decides whether it breaks a limit); a decrease
// or no change in cost is Info. Pure.
import { ASSUMPTION_LABEL } from "../assumptions";
import { attendanceDelta, describeChange, formatCount } from "../change-event";
import type { ImpactItem } from "../impact-item";
import type { BudgetTools, RuleContext } from "../registry";

export type CateringEstimate =
  | { status: "NOT_SET" }
  | {
      status: "ESTIMATED";
      /** Signed difference in people. */
      people: number;
      costPerHead: string;
      direction: "INCREASE" | "DECREASE" | "NONE";
      /** Size of the change, never negative, as a two-place peso string. */
      amount: string;
    };

export function estimateCatering(
  people: number,
  costPerHead: string | null,
  tools: Pick<BudgetTools, "toCentavos" | "fromCentavos">,
): CateringEstimate {
  if (costPerHead === null) return { status: "NOT_SET" };
  const centavos = tools.toCentavos(costPerHead) * BigInt(people);
  const negative = centavos < BigInt(0);
  return {
    status: "ESTIMATED",
    people,
    costPerHead,
    direction: centavos === BigInt(0) ? "NONE" : negative ? "DECREASE" : "INCREASE",
    amount: tools.fromCentavos(negative ? -centavos : centavos),
  };
}

const people = (n: number) => (Math.abs(n) === 1 ? "1 person" : `${formatCount(Math.abs(n))} people`);
/** "40 more people" / "1 fewer person". */
const morePeople = (n: number) =>
  `${formatCount(Math.abs(n))} ${n > 0 ? "more" : "fewer"} ${Math.abs(n) === 1 ? "person" : "people"}`;

export function cateringCostRule({ change, catering, tools }: RuleContext): ImpactItem[] {
  const base = { key: "catering-cost", area: "CATERING", basis: "ESTIMATE", references: [] } as const;
  const delta = attendanceDelta(change);

  if (catering.status === "NOT_SET") {
    return [
      {
        ...base,
        severity: "INFO",
        title: "Catering cost not estimated",
        reason: `No catering cost per head is set, so the cost of ${delta > 0 ? "adding" : "removing"} ${people(delta)} (${describeChange(change)}) can't be estimated.`,
        assumptions: [{ label: ASSUMPTION_LABEL.cateringCostPerHead, value: "Not set" }],
        fix: { target: "assumptions", label: "Set the cost per head" },
      },
    ];
  }

  const amount = tools.formatPesos(catering.amount);
  const perHead = tools.formatPesos(catering.costPerHead);
  const assumptions = [{ label: ASSUMPTION_LABEL.cateringCostPerHead, value: perHead }];

  if (catering.direction === "NONE") {
    return [
      {
        ...base,
        severity: "INFO",
        title: "No catering cost change estimated",
        reason: `At ${perHead} per head, ${describeChange(change)} changes the estimated catering cost by ₱0.00.`,
        assumptions,
        fix: null,
      },
    ];
  }

  if (catering.direction === "INCREASE") {
    return [
      {
        ...base,
        severity: "NEEDS_ATTENTION",
        title: `Catering may increase by ${amount}`,
        reason: `${morePeople(delta)} expected (${describeChange(change)}) at ${perHead} per head. This is an estimate, not a quote: confirm the new amount with your caterer.`,
        assumptions,
        fix: { target: "budget", label: "Review the budget" },
      },
    ];
  }

  return [
    {
      ...base,
      severity: "INFO",
      title: `Catering may decrease by ${amount}`,
      reason: `${morePeople(delta)} expected (${describeChange(change)}) at ${perHead} per head. Check your catering contract: a smaller headcount doesn't always lower the price.`,
      assumptions,
      fix: null,
    },
  ];
}