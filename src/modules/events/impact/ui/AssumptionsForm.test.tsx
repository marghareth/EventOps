// src/modules/events/impact/ui/AssumptionsForm.test.tsx
// The assumptions form (B7-F12, B7-F15, B7-F17; D-102): current values shown, blanks for "not set",
// the version and the proposal carried as hidden fields, every server error listed at once in a
// summary that takes focus, typed values kept after a failed save, and a category that no longer
// exists not silently re-selected.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const saveAssumptionsAction = vi.fn();
vi.mock("../actions", () => ({
  saveAssumptionsAction: (...args: unknown[]) => saveAssumptionsAction(...args),
  saveAnalysisAction: vi.fn(),
}));

const { AssumptionsForm } = await import("./AssumptionsForm");

const EVENT = "3f2c1b8e-9a4d-4c1e-8b2a-6d5f4e3c2b1a";
const CATERING = "c0000000-0000-4000-8000-000000000001";

const renderForm = (current: Partial<Parameters<typeof AssumptionsForm>[0]["current"]> = {}) =>
  render(
    <AssumptionsForm
      eventId={EVENT}
      categories={[{ id: CATERING, name: "Catering" }]}
      proposal={220}
      current={{
        cateringCostPerHead: null,
        accessibleSeatsPer100: null,
        cateringCategoryId: null,
        version: "",
        ...current,
      }}
    />,
  );

describe("the assumptions form", () => {
  it("shows blanks for values that are not set, and the stored values otherwise", () => {
    const { unmount } = renderForm();
    expect(screen.getByLabelText(/Catering cost per head/)).toHaveValue("");
    expect(screen.getByLabelText(/Accessible seats per 100 guests/)).toHaveValue("");
    expect(screen.getByLabelText(/Catering budget category/)).toHaveValue("");
    unmount();
    renderForm({
      cateringCostPerHead: "300.00",
      accessibleSeatsPer100: "4.55",
      cateringCategoryId: CATERING,
      version: "2026-10-20T01:00:00.000Z",
    });
    expect(screen.getByLabelText(/Catering cost per head/)).toHaveValue("300.00");
    expect(screen.getByLabelText(/Accessible seats per 100 guests/)).toHaveValue("4.55");
    expect(screen.getByLabelText(/Catering budget category/)).toHaveValue(CATERING);
  });

  it("sends the version and the proposal on screen", async () => {
    saveAssumptionsAction.mockResolvedValue({ status: "idle" });
    renderForm({ version: "2026-10-20T01:00:00.000Z" });
    await userEvent.type(screen.getByLabelText(/Catering cost per head/), "350");
    await userEvent.click(screen.getByRole("button", { name: "Save assumptions" }));
    const data = saveAssumptionsAction.mock.calls[0]![2] as FormData;
    expect(saveAssumptionsAction.mock.calls[0]![0]).toBe(EVENT);
    expect(data.get("cateringCostPerHead")).toBe("350");
    expect(data.get("version")).toBe("2026-10-20T01:00:00.000Z");
    expect(data.get("to")).toBe("220");
  });

  it("lists every server error at once, focuses the summary and keeps what was typed", async () => {
    saveAssumptionsAction.mockResolvedValue({
      status: "error",
      fieldErrors: {
        cateringCostPerHead: "Enter a peso amount with at most two decimals.",
        accessibleSeatsPer100: "Enter a number from 0 to 100.",
      },
      values: { cateringCostPerHead: "-1", accessibleSeatsPer100: "101", cateringCategoryId: "" },
    });
    renderForm();
    await userEvent.click(screen.getByRole("button", { name: "Save assumptions" }));
    const summary = await screen.findByRole("group", { name: "Fix these to continue" });
    expect(summary).toHaveFocus();
    expect(summary).toHaveTextContent("Enter a peso amount with at most two decimals.");
    expect(summary).toHaveTextContent("Enter a number from 0 to 100.");
    expect(screen.getByLabelText(/Catering cost per head/)).toHaveValue("-1");
    expect(screen.getByLabelText(/Catering cost per head/)).toHaveAttribute("aria-invalid", "true");
  });

  it("shows a refusal from the server as a critical banner", async () => {
    saveAssumptionsAction.mockResolvedValue({
      status: "error",
      message: "Someone else changed the assumptions while you were editing.",
      values: { cateringCostPerHead: "", accessibleSeatsPer100: "", cateringCategoryId: "" },
    });
    renderForm();
    await userEvent.click(screen.getByRole("button", { name: "Save assumptions" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Someone else changed the assumptions while you were editing.",
    );
  });

  it("does not re-select a category that no longer exists", () => {
    renderForm({ cateringCategoryId: "c0000000-0000-4000-8000-0000000000ff" });
    expect(screen.getByLabelText(/Catering budget category/)).toHaveValue("");
  });
});