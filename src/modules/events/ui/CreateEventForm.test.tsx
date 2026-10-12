// src/modules/events/ui/CreateEventForm.test.tsx
// Create Event form with the server action mocked: labels, accessible errors, kept input,
// the loading state and the save-failure banner (B1-02).
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CreateEventFormState } from "../form-state";
import { CreateEventForm } from "./CreateEventForm";

type Action = (s: CreateEventFormState, f: FormData) => Promise<CreateEventFormState>;

describe("CreateEventForm", () => {
  it("labels every field and sends what the user typed", async () => {
    const action = vi.fn<Action>().mockResolvedValue({ status: "idle" });
    render(<CreateEventForm action={action} />);
    await userEvent.type(screen.getByLabelText(/Event name/), "Santos wedding");
    await userEvent.type(screen.getByLabelText(/Venue \(optional\)/), "Cebu");
    await userEvent.type(screen.getByLabelText(/Expected attendees/), "180");
    await userEvent.click(screen.getByRole("button", { name: "Create event" }));

    const data = action.mock.calls[0][1];
    expect(data.get("name")).toBe("Santos wedding");
    expect(data.get("venue")).toBe("Cebu");
    expect(data.get("expectedAttendees")).toBe("180");
    for (const label of [/^Date/, /^Start time/, /^End time/, /Description/, /Venue capacity/]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  it("shows field errors on the controls and in a summary, keeping the input", async () => {
    const action = vi.fn<Action>().mockResolvedValue({
      status: "error",
      fieldErrors: { date: "Enter the event date." },
      values: { name: "Santos wedding", date: "" },
    });
    render(<CreateEventForm action={action} />);
    await userEvent.click(screen.getByRole("button", { name: "Create event" }));

    expect(await screen.findByRole("link", { name: "Enter the event date." })).toBeInTheDocument();
    const date = screen.getByLabelText(/^Date/);
    expect(date).toHaveAttribute("aria-invalid", "true");
    expect(date).toHaveAccessibleDescription(/Enter the event date\./);
    expect(screen.getByLabelText(/Event name/)).toHaveValue("Santos wedding");
  });

  it("disables the button and says it is working while saving", async () => {
    let finish: (state: CreateEventFormState) => void = () => {};
    const action = vi.fn<Action>(() => new Promise((resolve) => (finish = resolve)));
    render(<CreateEventForm action={action} />);
    await userEvent.click(screen.getByRole("button", { name: "Create event" }));

    const busy = await screen.findByRole("button", { name: "Creating event…" });
    expect(busy).toBeDisabled();
    finish({ status: "idle" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Create event" })).toBeEnabled());
  });

  it("shows a save failure as a banner", async () => {
    const action = vi.fn<Action>().mockResolvedValue({
      status: "error",
      message: "We couldn't save the event. Try again in a moment.",
    });
    render(<CreateEventForm action={action} />);
    await userEvent.click(screen.getByRole("button", { name: "Create event" }));
    expect(await screen.findByText(/We couldn't save the event/)).toBeInTheDocument();
    expect(screen.getByText("Couldn't create the event")).toBeInTheDocument();
  });
});