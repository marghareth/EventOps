// src/modules/events/budget/ui/BudgetStatusBadge.test.tsx
// The budget status badge (B5-F08): the canonical label as text with an icon for every status, so
// meaning never depends on color alone.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BUDGET_STATUSES, BUDGET_STATUS_LABELS } from "../domain/budget-summary";
import { BudgetStatusBadge } from "./BudgetStatusBadge";

describe("BudgetStatusBadge", () => {
  it.each(BUDGET_STATUSES)("writes %s as its canonical label with an icon", (status) => {
    const { container } = render(<BudgetStatusBadge status={status} />);
    expect(screen.getByText(BUDGET_STATUS_LABELS[status])).toBeVisible();
    expect(container.querySelector("svg")).not.toBeNull();
  });
});