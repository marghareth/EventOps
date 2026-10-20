// src/modules/events/impact/infrastructure/event-state-reader.ts
// Builds the impact rules' EventState from each context's own public, authorized read (D-001,
// D-101): the budget (D-084 to D-088), accessibility readiness and alerts (D-062 to D-066) and the
// tasks (D-094 to D-096). Each read authorizes the signed-in user on its own (event.view), so this
// reader can never see more than the user can. Nothing is recalculated here.
import "server-only";
import {
  getAccessibilityAlerts,
  getAccessibilityOverview,
} from "@/modules/events/accessibility/public";
import { getEventBudget } from "@/modules/events/budget/public";
import { formatTaskReference, getEventTasks } from "@/modules/events/tasks/public";
import type { EventStateReader } from "../application/ports";

export const eventStateReader: EventStateReader = {
  async read(event) {
    const [budget, overview, alerts, tasks] = await Promise.all([
      getEventBudget(event.id),
      getAccessibilityOverview(event.id),
      getAccessibilityAlerts(event.id),
      getEventTasks(event.id),
    ]);
    if (!budget.ok || !overview.ok || !alerts.ok || !tasks.ok) return null;
    return {
      expectedAttendees: event.expectedAttendees,
      capacity: event.capacity,
      budget: budget.categories.map((category) => ({
        id: category.id,
        name: category.name,
        allocation: category.allocation,
        items: category.items.map(({ estimated, committed, paid }) => ({
          estimated,
          committed,
          paid,
        })),
      })),
      accessibility: {
        alerts: alerts.alerts.map(({ key, severity, title, reason }) => ({
          key,
          severity,
          title,
          reason,
        })),
        seatsAvailable: overview.readiness.coverage.seats.available,
        seatsRecordedNeeds: overview.readiness.coverage.seats.required,
      },
      tasks: tasks.tasks.map((task) => ({
        reference: formatTaskReference(task.number),
        title: task.title,
        description: task.description,
        done: task.status === "DONE",
      })),
    };
  },
};