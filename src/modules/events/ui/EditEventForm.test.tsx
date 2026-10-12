// src/modules/events/ui/EditEventForm.test.tsx
// Edit Event form with the server action mocked (B1-05): saved values, version, errors, loading
// and success.
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { EditEventFormState } from "../form-state";
import { EditEventForm } from "./EditEventForm";

type Action = (s: EditEventFormState, f: FormData) => Promise<EditEventFormState>;

const saved = {
  name: "Santos wedding",
  date: "2026-12-12",
  startTime: "16:00",
  endTime: "22:00",
  venue: "Cebu",
  description: "",
  capacity: "200",
  expectedAttendees: "180",
};
const VERSION = "2026-10-11T01:02:03.456Z";

function setup(action: Action, values = saved, version = VERSION) {
  return render(<EditEventForm action={action} saved={values} version={version} />);
}

describe("EditEventForm", () => {
  it("shows the saved values and sends changes with the loaded version", async () => {
    const action = vi
      .fn<Action>()
      .mockResolvedValue({ status: "success", message: "Changes saved." });
    setup(action);
    expect(screen.getByLabelText(/Event name/)).toHaveValue("Santos wedding");
    expect(screen.getByLabelText(/^Date/)).toHaveValue("2026-12-12");
    expect(screen.getByLabelText(/^Start time/)).toHaveValue("16:00");
    expect(screen.getByLabelText(/Expected attendees/)).toHaveValue("180");

    const name = screen.getByLabelText(/Event name/);
    await userEvent.clear(name);
    await userEvent.type(name, "Santos–Lim wedding");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    const data = action.mock.calls[0][1];
    expect(data.get("name")).toBe("Santos–Lim wedding");
    expect(data.get("venue")).toBe("Cebu");
    expect(data.get("version")).toBe(VERSION);
    expect(await screen.findByText("Changes saved.")).toBeInTheDocument();
  });

  it("disables the button and says it is saving", async () => {
    let finish: (state: EditEventFormState) => void = () => {};
    const action = vi.fn<Action>(() => new Promise((resolve) => (finish = resolve)));
    setup(action);
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("button", { name: "Saving changes…" })).toBeDisabled();
    finish({ status: "success", message: "Changes saved." });
    await waitFor(() => expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled());
  });

  it("shows field errors and keeps what the user typed", async () => {
    const action = vi.fn<Action>().mockResolvedValue({
      status: "error",
      fieldErrors: { name: "Enter the event name." },
      values: { ...saved, name: "", venue: "Typed venue" },
    });
    setup(action);
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("link", { name: "Enter the event name." })).toBeInTheDocument();
    expect(screen.getByLabelText(/Event name/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(/Venue \(optional\)/)).toHaveValue("Typed venue");
  });

  it("shows a stale-save message as a banner", async () => {
    const action = vi.fn<Action>().mockResolvedValue({
      status: "error",
      message: "This event changed since you opened it.",
      values: saved,
    });
    setup(action);
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Couldn't save your changes")).toBeInTheDocument();
    expect(screen.getByText(/changed since you opened it/)).toBeInTheDocument();
  });

  it("shows the newly saved values when the page reloads them", () => {
    const action = vi.fn<Action>();
    const { rerender } = setup(action);
    rerender(
      <EditEventForm
        action={action}
        saved={{ ...saved, name: "Renamed" }}
        version="2026-10-11T02:00:00.000Z"
      />,
    );
    expect(screen.getByLabelText(/Event name/)).toHaveValue("Renamed");
  });
});