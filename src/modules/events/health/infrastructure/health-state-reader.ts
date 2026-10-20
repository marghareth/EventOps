// src/modules/events/health/infrastructure/health-state-reader.ts
// Builds the Event Health state from each context's own public, authorized read (D-001, D-105), with
// that context's rules already applied: the guest list facts and headcount (D-046), the supplier
// overview (D-078, D-079), the budget summary and warnings (D-088, D-090), accessibility readiness
// and alerts (D-063, D-066) and the task overdue rule (D-098). Every read authorizes the signed-in
// user (event.view), so health can never show more than the member can see. No contact value or
// note is read into the state.
import "server-only";
import {
  READINESS_STATUS_DEFINITIONS,
  getAccessibilityAlerts,
  getAccessibilityOverview,
} from "@/modules/events/accessibility/public";
import {
  expectedHeadcount,
  formatAttendeeReference,
  getAttendeeHealthFacts,
} from "@/modules/events/attendees/public";
import {
  formatPesos,
  getEventBudget,
  overBudgetWarnings,
  summarizeEventBudget,
} from "@/modules/events/budget/public";
import { formatSupplierReference, getEventSuppliers } from "@/modules/events/suppliers/public";
import {
  formatTaskReference,
  getEventTasks,
  isTaskOverdue,
  manilaToday,
} from "@/modules/events/tasks/public";
import type { HealthStateReader } from "../application/build-health-state";

export const healthStateReader: HealthStateReader = {
  async read(event) {
    const [attendees, suppliers, budget, overview, alerts, tasks] = await Promise.all([
      getAttendeeHealthFacts(event.id),
      getEventSuppliers(event.id),
      getEventBudget(event.id),
      getAccessibilityOverview(event.id),
      getAccessibilityAlerts(event.id),
      getEventTasks(event.id),
    ]);
    if (!attendees.ok || !suppliers.ok || !budget.ok || !overview.ok || !alerts.ok || !tasks.ok) {
      return null;
    }

    const summary = summarizeEventBudget(
      budget.categories.map(({ id, name, allocation, items }) => ({ id, name, allocation, items })),
    );
    // One "today" for the whole read, in Philippine time (D-025), as the task list uses.
    const today = manilaToday(new Date());
    const status = overview.readiness.status;

    return {
      accessibilityLabel: READINESS_STATUS_DEFINITIONS[status].label,
      state: {
        expectedAttendees: event.expectedAttendees,
        capacity: event.capacity,
        attendees: attendees.attendees.map((a) => ({
          reference: formatAttendeeReference(a.number),
          name: a.name,
          rsvpStatus: a.rsvpStatus,
          hasContact: a.hasContact,
        })),
        confirmedHeadcount: expectedHeadcount(attendees.attendees).total,
        suppliers: suppliers.suppliers.map((s) => ({
          reference: formatSupplierReference(s.number),
          name: s.name,
          confirmed: s.overview.acceptedQuote !== null,
          overduePayments: s.overview.due.overdueCount,
          hasContact: Boolean(s.email?.trim() || s.phone?.trim()),
        })),
        budget: {
          hasCategories: budget.categories.length > 0,
          allocatedText: formatPesos(summary.event.allocated),
          remainingText:
            summary.event.overBy === null ? formatPesos(summary.event.remaining) : null,
          warnings: overBudgetWarnings(summary).map(({ scope, name, message }) => ({
            scope,
            name,
            message,
          })),
        },
        accessibility: {
          status,
          alerts: alerts.alerts.map(({ title, severity }) => ({ title, severity })),
        },
        tasks: tasks.tasks.map((t) => ({
          reference: formatTaskReference(t.number),
          title: t.title,
          priority: t.priority,
          done: t.status === "DONE",
          overdue: isTaskOverdue(t, today),
          assigned: t.assignee !== null,
        })),
      },
    };
  },
};