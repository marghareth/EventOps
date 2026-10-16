// src/modules/events/budget/ui/OverBudgetWarning.test.tsx
// The over-budget warning (B5-F09): hidden when nothing is over; otherwise one reason per limit,
// with the basis stated, as text with an icon and a polite status role.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { overBudgetWarnings, summarizeEventBudget } from "../domain/budget-summary";
import { OverBudgetWarning } from "./OverBudgetWarning";

const item = (committed: string) => ({ estimated: "0.00", committed, paid: "0.00" });

describe("OverBudgetWarning", () => {
  it("renders nothing when no limit is exceeded", () => {
    const { container } = render(<OverBudgetWarning warnings={[]} eventWithinBudget />);
    expect(container).toBeEmptyDOMElement();
  });

  it("explains each exceeded limit and the basis", () => {
    const summary = summarizeEventBudget([
      { id: "a", name: "Catering", allocation: "100.00", items: [item("150.00")] },
      { id: "b", name: "Venue", allocation: "500.00", items: [] },
    ]);
    const { container } = render(
      <OverBudgetWarning
        warnings={overBudgetWarnings(summary)}
        eventWithinBudget={summary.event.status === "WITHIN_BUDGET"}
      />,
    );
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Over budget: 1 limit exceeded");
    expect(status).toHaveTextContent(
      "Catering is over budget: ₱150.00 is committed and its allocation is ₱100.00, ₱50.00 more.",
    );
    expect(status).toHaveTextContent("Judged on committed amounts, not estimates.");
    expect(status).toHaveTextContent("The event as a whole is still within its total allocation.");
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("counts several limits and leaves out the within-event note when the event is over", () => {
    const summary = summarizeEventBudget([
      { id: "a", name: "Catering", allocation: "100.00", items: [item("150.00")] },
    ]);
    render(<OverBudgetWarning warnings={overBudgetWarnings(summary)} eventWithinBudget={false} />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Over budget: 2 limits exceeded");
    expect(status).not.toHaveTextContent("still within its total allocation");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
});