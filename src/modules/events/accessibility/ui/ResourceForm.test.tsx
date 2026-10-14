// src/modules/events/accessibility/ui/ResourceForm.test.tsx
// The resource form with the server action mocked (B3-05): status as a labelled radio group, a seat
// count only for accessible seats, set up vs edit, the version, and accessible server errors.
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ResourceFormState } from "../form-state";
import { ResourceForm } from "./ResourceForm";

type Action = (s: ResourceFormState, f: FormData) => Promise<ResourceFormState>;
const BACK = "/events/e1/accessibility";

describe("ResourceForm", () => {
  it("sets up accessible seats: status, a required count and a note", async () => {
    const action = vi.fn<Action>().mockResolvedValue({ status: "idle" });
    render(<ResourceForm action={action} type="ACCESSIBLE_SEATS" cancelHref={BACK} />);
    expect(screen.getByRole("group", { name: /Is it available\?/ })).toBeVisible();
    expect(screen.getByRole("radio", { name: "Being arranged" })).toHaveAccessibleDescription(
      "Planned, but not confirmed yet.",
    );
    expect(screen.getByLabelText(/^Number of accessible seats/)).toHaveAttribute(
      "aria-required",
      "true",
    );
    await userEvent.click(screen.getByRole("radio", { name: "Available" }));
    await userEvent.type(screen.getByLabelText(/^Number of accessible seats/), "8");
    await userEvent.type(screen.getByLabelText(/^Note/), "Front left");
    await userEvent.click(screen.getByRole("button", { name: "Set up" }));
    expect(Object.fromEntries(action.mock.calls[0][1])).toEqual({
      version: "",
      status: "AVAILABLE",
      quantity: "8",
      note: "Front left",
    });
  });

  it("has no seat count for other resources", () => {
    render(<ResourceForm action={vi.fn<Action>()} type="RAMP_OR_ELEVATOR" cancelHref={BACK} />);
    expect(screen.queryByLabelText(/Number of accessible seats/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute("href", BACK);
  });

  it("loads the stored values and version when editing", () => {
    render(
      <ResourceForm
        action={vi.fn<Action>()}
        type="ACCESSIBLE_SEATS"
        cancelHref={BACK}
        saved={{ status: "ARRANGING", quantity: "6", note: "By the stage" }}
        version="2026-10-13T00:00:00.000Z"
      />,
    );
    expect(screen.getByRole("radio", { name: "Being arranged" })).toBeChecked();
    expect(screen.getByLabelText(/^Number of accessible seats/)).toHaveValue(6);
    expect(screen.getByLabelText(/^Note/)).toHaveValue("By the stage");
    expect(document.querySelector("input[name=version]")).toHaveValue("2026-10-13T00:00:00.000Z");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeVisible();
  });

  it("shows the server's errors beside the fields and in a summary", async () => {
    const action = vi.fn<Action>().mockResolvedValue({
      status: "error",
      fieldErrors: {
        quantity: "Enter how many seats, as a whole number from 0 to 10,000.",
        status: "Choose whether this is available.",
      },
      values: { status: "", quantity: "-1", note: "" },
    });
    render(<ResourceForm action={action} type="ACCESSIBLE_SEATS" cancelHref={BACK} />);
    await userEvent.click(screen.getByRole("button", { name: "Set up" }));
    await waitFor(() =>
      expect(screen.getByLabelText(/^Number of accessible seats/)).toHaveAttribute(
        "aria-invalid",
        "true",
      ),
    );
    expect(screen.getByRole("link", { name: "Choose whether this is available." })).toHaveAttribute(
      "href",
      "#resource-status-0",
    );
    expect(screen.getByLabelText(/^Number of accessible seats/)).toHaveValue(-1);
  });
});