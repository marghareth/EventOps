// src/modules/events/attendees/ui/AttendeeForm.test.tsx
// The attendee form with the server action mocked: adding (B2-02) and editing (B2-03). Labels,
// defaults, stored values, accessible errors, kept input, loading state and failure banners.
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AttendeeFormState } from "../form-state";
import { AttendeeForm } from "./AttendeeForm";

type Action = (s: AttendeeFormState, f: FormData) => Promise<AttendeeFormState>;
const LIST = "/events/e1/attendees";

describe("AttendeeForm", () => {
  it("labels every field, marks the name required, and sends what was entered", async () => {
    const action = vi.fn<Action>().mockResolvedValue({ status: "idle" });
    render(<AttendeeForm action={action} cancelHref={LIST} />);

    expect(screen.getByLabelText(/^Name/)).toHaveAttribute("aria-required", "true");
    await userEvent.type(screen.getByLabelText(/^Name/), "Maria Santos");
    await userEvent.type(screen.getByLabelText(/^Email/), "maria@example.com");
    await userEvent.type(screen.getByLabelText(/^Phone/), "0917 123 4567");
    await userEvent.selectOptions(screen.getByLabelText(/^RSVP/), "Confirmed");
    await userEvent.clear(screen.getByLabelText(/^Plus-ones/));
    await userEvent.type(screen.getByLabelText(/^Plus-ones/), "2");
    await userEvent.type(screen.getByLabelText(/^Category/), "Family");
    await userEvent.type(screen.getByLabelText(/^Dietary needs/), "Vegetarian");
    await userEvent.type(screen.getByLabelText(/^Notes/), "Seat near the stage");
    await userEvent.click(screen.getByRole("button", { name: "Add attendee" }));

    expect(Object.fromEntries(action.mock.calls[0][1])).toEqual({
      name: "Maria Santos",
      email: "maria@example.com",
      phone: "0917 123 4567",
      rsvpStatus: "CONFIRMED",
      plusOnes: "2",
      category: "Family",
      dietaryNeeds: "Vegetarian",
      notes: "Seat near the stage",
    });
  });

  it("starts with RSVP Pending and no plus-ones, and offers exactly the four RSVP values", () => {
    render(<AttendeeForm action={vi.fn<Action>()} cancelHref={LIST} />);
    expect(screen.getByLabelText(/^RSVP/)).toHaveValue("PENDING");
    expect(screen.getByLabelText(/^Plus-ones/)).toHaveValue(0);
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Pending",
      "Confirmed",
      "Declined",
      "Maybe",
    ]);
  });

  it("explains the limits next to the fields and stops typing past them", () => {
    render(<AttendeeForm action={vi.fn<Action>()} cancelHref={LIST} />);
    expect(screen.getByLabelText(/^Plus-ones/)).toHaveAccessibleDescription(
      "Guests coming with them: 0 for none, up to 10.",
    );
    expect(screen.getByLabelText(/^Notes/)).toHaveAttribute("maxLength", "2000");
    expect(screen.getByLabelText(/^Dietary needs/)).toHaveAttribute("maxLength", "500");
    // B2-06, D-047: several needs in one entry; clearing the field removes them.
    expect(screen.getByLabelText(/^Dietary needs/)).toHaveAccessibleDescription(
      "Separate several needs with semicolons, for example: Vegetarian; no nuts. Leave empty to remove. Up to 500 characters.",
    );
    expect(screen.getByLabelText(/^Name/)).toHaveAttribute("maxLength", "120");
  });

  it("shows field errors on the controls and in a summary, keeping the input", async () => {
    const action = vi.fn<Action>().mockResolvedValue({
      status: "error",
      fieldErrors: {
        name: "Enter the attendee's name.",
        plusOnes: "Plus-ones must be a whole number from 0 to 10.",
      },
      values: { name: "", email: "maria@example.com", plusOnes: "12" },
    });
    render(<AttendeeForm action={action} cancelHref={LIST} />);
    await userEvent.click(screen.getByRole("button", { name: "Add attendee" }));

    expect(await screen.findByRole("link", { name: "Enter the attendee's name." })).toHaveAttribute(
      "href",
      "#add-attendee-name",
    );
    const plusOnes = screen.getByLabelText(/^Plus-ones/);
    expect(plusOnes).toHaveAttribute("aria-invalid", "true");
    expect(plusOnes).toHaveAccessibleDescription(/whole number from 0 to 10/);
    expect(plusOnes).toHaveValue(12);
    expect(screen.getByLabelText(/^Email/)).toHaveValue("maria@example.com");
  });

  it("disables the button and says it is working while saving, so it can't be sent twice", async () => {
    let finish: (state: AttendeeFormState) => void = () => {};
    const action = vi.fn<Action>(() => new Promise((resolve) => (finish = resolve)));
    render(<AttendeeForm action={action} cancelHref={LIST} />);
    await userEvent.type(screen.getByLabelText(/^Name/), "Maria");
    await userEvent.click(screen.getByRole("button", { name: "Add attendee" }));

    const busy = await screen.findByRole("button", { name: "Adding attendee…" });
    expect(busy).toBeDisabled();
    await userEvent.click(busy);
    expect(action).toHaveBeenCalledOnce();
    finish({ status: "idle" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Add attendee" })).toBeEnabled());
  });

  it("shows a server failure as an alert and keeps the input", async () => {
    const action = vi.fn<Action>().mockResolvedValue({
      status: "error",
      message: "We couldn't save the attendee. Try again in a moment.",
      values: { name: "Maria Santos" },
    });
    render(<AttendeeForm action={action} cancelHref={LIST} />);
    await userEvent.click(screen.getByRole("button", { name: "Add attendee" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't add the attendee");
    expect(screen.getByLabelText(/^Name/)).toHaveValue("Maria Santos");
  });

  it("cancels back to the guest list", () => {
    render(<AttendeeForm action={vi.fn<Action>()} cancelHref={LIST} />);
    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute("href", LIST);
  });
});

describe("AttendeeForm in edit mode (B2-03)", () => {
  const saved = {
    name: "Ana Reyes",
    email: "ana@example.com",
    phone: "0917 555 0101",
    category: "Family",
    rsvpStatus: "CONFIRMED",
    plusOnes: "1",
    dietaryNeeds: "Vegetarian",
    notes: "Near the stage",
  };
  const VERSION = "2026-10-12T04:00:00.000Z";
  const renderEdit = (action: Action) =>
    render(
      <AttendeeForm
        mode="edit"
        action={action}
        cancelHref={LIST}
        saved={saved}
        version={VERSION}
      />,
    );

  it("loads every stored value into its field", () => {
    renderEdit(vi.fn<Action>());
    expect(screen.getByLabelText(/^Name/)).toHaveValue("Ana Reyes");
    expect(screen.getByLabelText(/^Email/)).toHaveValue("ana@example.com");
    expect(screen.getByLabelText(/^Phone/)).toHaveValue("0917 555 0101");
    expect(screen.getByLabelText(/^Category/)).toHaveValue("Family");
    expect(screen.getByLabelText(/^RSVP/)).toHaveValue("CONFIRMED");
    expect(screen.getByLabelText(/^Plus-ones/)).toHaveValue(1);
    expect(screen.getByLabelText(/^Dietary needs/)).toHaveValue("Vegetarian");
    expect(screen.getByLabelText(/^Notes/)).toHaveValue("Near the stage");
  });

  it("sends every field changed, plus the stored version", async () => {
    const action = vi.fn<Action>().mockResolvedValue({ status: "idle" });
    renderEdit(action);
    const replace = async (label: RegExp, text: string) => {
      await userEvent.clear(screen.getByLabelText(label));
      await userEvent.type(screen.getByLabelText(label), text);
    };
    await replace(/^Name/, "Ana R. Lim");
    await replace(/^Email/, "ana.lim@example.com");
    await replace(/^Phone/, "+63 917 000 0000");
    await replace(/^Category/, "Friends");
    await userEvent.selectOptions(screen.getByLabelText(/^RSVP/), "Declined");
    await replace(/^Plus-ones/, "0");
    await replace(/^Dietary needs/, "None");
    await userEvent.clear(screen.getByLabelText(/^Notes/));
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(Object.fromEntries(action.mock.calls[0][1])).toEqual({
      version: VERSION,
      name: "Ana R. Lim",
      email: "ana.lim@example.com",
      phone: "+63 917 000 0000",
      category: "Friends",
      rsvpStatus: "DECLINED",
      plusOnes: "0",
      dietaryNeeds: "None",
      notes: "",
    });
  });

  it("says it is saving and blocks a second submit", async () => {
    let finish: (state: AttendeeFormState) => void = () => {};
    const action = vi.fn<Action>(() => new Promise((resolve) => (finish = resolve)));
    renderEdit(action);
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("button", { name: "Saving changes…" })).toBeDisabled();
    finish({ status: "idle" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled());
  });

  it("explains a stale save without losing the edits", async () => {
    const action = vi.fn<Action>().mockResolvedValue({
      status: "error",
      message: "This attendee changed since you opened them.",
      values: { ...saved, name: "My edit" },
    });
    renderEdit(action);
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't save the changes");
    expect(screen.getByLabelText(/^Name/)).toHaveValue("My edit");
  });

  it("says when there was nothing to save, keeping the stored values", async () => {
    const action = vi
      .fn<Action>()
      .mockResolvedValue({ status: "success", message: "No changes to save." });
    renderEdit(action);
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("No changes to save.")).toBeVisible();
    expect(screen.getByLabelText(/^Name/)).toHaveValue("Ana Reyes");
  });

  it("links errors to the edit form's own fields", async () => {
    const action = vi.fn<Action>().mockResolvedValue({
      status: "error",
      fieldErrors: { name: "Enter the attendee's name." },
      values: { ...saved, name: "" },
    });
    renderEdit(action);
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("link", { name: "Enter the attendee's name." })).toHaveAttribute(
      "href",
      "#edit-attendee-name",
    );
  });
});