// src/modules/events/health/domain/checks/supplier-confirmations.ts
// Supplier health (B8-F03; D-105, checks S1 to S3). Pure. A supplier is "confirmed" when it has an
// Accepted quote (D-076); overdue payments use the suppliers' own rule (D-079).
//   S1 every supplier confirmed       not confirmed → Needs attention
//   S2 no overdue supplier payments   overdue → Critical
//   S3 every supplier has phone/email missing → Needs attention
// All three are Not checked while the event has no suppliers.
import type { HealthCheckResult } from "../health-check";
import { count, nameList } from "../health-check";
import type { HealthState } from "../health-state";

const fix = { target: "suppliers", label: "Open Suppliers" } as const;

export function supplierChecks(state: HealthState): HealthCheckResult[] {
  const suppliers = state.suppliers;
  const base = (id: string, label: string) => ({ id, area: "SUPPLIERS" as const, label });
  if (suppliers.length === 0) {
    const reason = "The event has no suppliers yet, so this can't be checked.";
    const add = { target: "suppliers", label: "Add a supplier" } as const;
    return [
      {
        ...base("suppliers.confirmed", "Every supplier is confirmed"),
        outcome: "NOT_CHECKED",
        summary: "No suppliers yet",
        reason,
        references: [],
        fix: add,
      },
      {
        ...base("suppliers.overdue", "No supplier payment is overdue"),
        outcome: "NOT_CHECKED",
        summary: "No suppliers yet",
        reason,
        references: [],
        fix: add,
      },
      {
        ...base("suppliers.contact", "Every supplier has a phone or email"),
        outcome: "NOT_CHECKED",
        summary: "No suppliers yet",
        reason,
        references: [],
        fix: add,
      },
    ];
  }

  const unconfirmed = suppliers.filter((s) => !s.confirmed);
  const overdue = suppliers.filter((s) => s.overduePayments > 0);
  const unreachable = suppliers.filter((s) => !s.hasContact);
  const payments = overdue.reduce((sum, s) => sum + s.overduePayments, 0);

  return [
    unconfirmed.length > 0
      ? {
          ...base("suppliers.confirmed", "Every supplier is confirmed"),
          outcome: "NEEDS_ATTENTION",
          summary: `${count(unconfirmed.length, "supplier isn't", "suppliers aren't")} confirmed`,
          reason: `No quote has been accepted for ${nameList(unconfirmed)}. A supplier counts as confirmed once one of its quotes is Accepted.`,
          references: unconfirmed.map((s) => s.reference),
          fix,
        }
      : {
          ...base("suppliers.confirmed", "Every supplier is confirmed"),
          outcome: "PASSED",
          summary: `All ${count(suppliers.length, "supplier", "suppliers")} confirmed`,
          reason: "Every supplier has an Accepted quote.",
          references: [],
          fix: null,
        },
    overdue.length > 0
      ? {
          ...base("suppliers.overdue", "No supplier payment is overdue"),
          outcome: "CRITICAL",
          summary: `${count(payments, "payment is", "payments are")} overdue`,
          reason: `Unpaid payments are past their due date (Philippine time) for ${nameList(overdue)}.`,
          references: overdue.map((s) => s.reference),
          fix,
        }
      : {
          ...base("suppliers.overdue", "No supplier payment is overdue"),
          outcome: "PASSED",
          summary: "No overdue payments",
          reason: "No unpaid supplier payment is past its due date.",
          references: [],
          fix: null,
        },
    unreachable.length > 0
      ? {
          ...base("suppliers.contact", "Every supplier has a phone or email"),
          outcome: "NEEDS_ATTENTION",
          summary: `${count(unreachable.length, "supplier has", "suppliers have")} no phone or email`,
          reason: `No phone or email is recorded for ${nameList(unreachable)}.`,
          references: unreachable.map((s) => s.reference),
          fix,
        }
      : {
          ...base("suppliers.contact", "Every supplier has a phone or email"),
          outcome: "PASSED",
          summary: "Every supplier can be reached",
          reason: "Every supplier has a phone or an email recorded.",
          references: [],
          fix: null,
        },
  ];
}