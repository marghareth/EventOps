// src/modules/events/accessibility/ui/RequirementForm.test.tsx
// The accessibility need form with the server action mocked (B3-04): labelled radio groups built
// from the canonical definitions, types already added can't be chosen, Required by default, stored
// values and version when editing, accessible errors from the server, and kept input.
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RequirementFormState } from "../form-state";
import { RequirementForm } from "./RequirementForm";

type Action = (s: RequirementFormState, f: FormData) => Promise<RequirementFormState>;
const BACK = "/events/e1/attendees/a1";

describe("RequirementForm", () => {
  it("asks two labelled questions and sends what was chosen", async () => {
    const action = vi.fn<Action>().mockResolvedValue({ status: "idle" });
    render(<RequirementForm action={action} cancelHref={BACK} takenTypes={[]} />);

    const needs = screen.getByRole("group", { name: /What does the guest need\?/ });
    expect(within(needs).getAllByRole("radio")).toHaveLength(7);
    const priority = screen.getByRole("group", { name: "How important is it?" });
    expect(
      within(priority)
        .getAllByRole("radio")
        .map((r) => r.getAttribute("value")),
    ).toEqual(["REQUIRED", "PREFERRED", "INFORMATIONAL"]);

    await userEvent.click(screen.getByRole("radio", { name: /Captioning/ }));
    await userEvent.click(screen.getByRole("radio", { name: /Preferred/ }));
    await userEvent.type(screen.getByLabelText("Note"), "Front rows");
    await userEvent.click(screen.getByRole("button", { name: "Add need" }));

    expect(Object.fromEntries(action.mock.calls[0][1])).toEqual({
      type: "CAPTIONING",
      priority: "PREFERRED",
      note: "Front rows",
    });
  });

  it("describes every choice, starts on Required, and explains the note", () => {
    render(<RequirementForm action={vi.fn<Action>()} cancelHref={BACK} takenTypes={[]} />);
    expect(screen.getByRole("radio", { name: "Step-free entry" })).toHaveAccessibleDescription(
      "Needs to get in and around without steps: a ramp, an elevator or a level entrance.",
    );
    expect(screen.getByRole("radio", { name: /^Required/ })).toBeChecked();
    expect(screen.getByLabelText("Note")).toHaveAccessibleDescription(
      "Required for Other. Visible to Owners and Coordinators only. Up to 500 characters.",
    );
    expect(screen.getByLabelText("Note")).toHaveAttribute("maxLength", "500");
    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute("href", BACK);
  });

  it("can't choose a type the guest already has, and says why", () => {
    render(
      <RequirementForm
        action={vi.fn<Action>()}
        cancelHref={BACK}
        takenTypes={["ACCESSIBLE_SEATING", "OTHER"]}
      />,
    );
    expect(
      screen.getByRole("radio", { name: /Accessible seating \(already added\)/ }),
    ).toBeDisabled();
    expect(screen.getByRole("radio", { name: /Other \(already added\)/ })).toBeDisabled();
    expect(screen.getByRole("radio", { name: /^Captioning/ })).toBeEnabled();
  });

  it("loads the stored values and version when editing", () => {
    render(
      <RequirementForm
        action={vi.fn<Action>()}
        cancelHref={BACK}
        takenTypes={["CAPTIONING"]}
        mode="edit"
        saved={{ type: "OTHER", priority: "INFORMATIONAL", note: "Guide dog" }}
        version="2026-10-13T00:00:00.000Z"
      />,
    );
    expect(screen.getByRole("radio", { name: /^Other/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /For information/ })).toBeChecked();
    expect(screen.getByLabelText("Note")).toHaveValue("Guide dog");
    expect(document.querySelector("input[name=version]")).toHaveValue("2026-10-13T00:00:00.000Z");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeVisible();
  });

  it("shows the server's field errors, linked from a summary, and keeps the input", async () => {
    const action = vi.fn<Action>().mockResolvedValue({
      status: "error",
      fieldErrors: { note: "Describe what the guest needs.", type: "Choose what the guest needs." },
      values: { type: "", priority: "PREFERRED", note: "" },
    });
    render(<RequirementForm action={action} cancelHref={BACK} takenTypes={[]} />);
    await userEvent.click(screen.getByRole("button", { name: "Add need" }));

    await waitFor(() =>
      expect(screen.getByLabelText("Note")).toHaveAttribute("aria-invalid", "true"),
    );
    expect(screen.getByLabelText("Note")).toHaveAccessibleDescription(
      expect.stringContaining("Describe what the guest needs."),
    );
    expect(
      screen.getByRole("group", { name: /What does the guest need\?/ }),
    ).toHaveAccessibleDescription(expect.stringContaining("Choose what the guest needs."));
    const summary = screen.getByRole("link", { name: "Choose what the guest needs." });
    expect(summary).toHaveAttribute("href", "#add-requirement-type-0");
    expect(screen.getByRole("radio", { name: /Preferred/ })).toBeChecked();
  });

  it("shows a refusal from the server in a banner", async () => {
    const action = vi.fn<Action>().mockResolvedValue({
      status: "error",
      message: "Your role can view accessibility information but not change it.",
    });
    render(<RequirementForm action={action} cancelHref={BACK} takenTypes={[]} />);
    await userEvent.click(screen.getByRole("button", { name: "Add need" }));
    expect(await screen.findByText("Couldn't add the need")).toBeVisible();
    expect(screen.getByText(/not change it/)).toBeVisible();
  });
});