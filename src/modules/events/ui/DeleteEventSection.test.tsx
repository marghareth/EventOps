// src/modules/events/ui/DeleteEventSection.test.tsx
// Delete Event confirmation (B1-06) with the server action mocked.
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { DeleteEventFormState } from "../form-state";
import { DeleteEventSection } from "./DeleteEventSection";

type Action = (s: DeleteEventFormState, f: FormData) => Promise<DeleteEventFormState>;

// jsdom does not implement the modal methods of <dialog>, so give it the minimal behavior.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});

function setup(action = vi.fn<Action>().mockResolvedValue({ status: "idle" })) {
  render(<DeleteEventSection action={action} name="Santos wedding" reference="EVT-2026-0001" />);
  return action;
}

async function openDialog() {
  await userEvent.click(screen.getByRole("button", { name: "Delete event" }));
  return screen.getByRole("alertdialog", { name: "Delete this event?" });
}

describe("DeleteEventSection", () => {
  it("says the deletion is permanent, naming the event", async () => {
    setup();
    const dialog = await openDialog();
    expect(dialog).toHaveAccessibleDescription(/Santos wedding \(EVT-2026-0001\).*can't undo this/);
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("keeps Delete disabled until the event number is typed exactly", async () => {
    const action = setup();
    const dialog = await openDialog();
    const confirm = within(dialog).getByRole("button", { name: "Delete event" });
    const input = within(dialog).getByLabelText("Type EVT-2026-0001 to confirm");
    expect(confirm).toBeDisabled();
    await userEvent.type(input, "EVT-2026-000");
    expect(confirm).toBeDisabled();
    await userEvent.type(input, "1");
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);
    expect(action).toHaveBeenCalledOnce();
    expect(action.mock.calls[0][1].get("confirmation")).toBe("EVT-2026-0001");
  });

  it("cancelling closes the dialog, clears the field and deletes nothing", async () => {
    const action = setup();
    const dialog = await openDialog();
    await userEvent.type(within(dialog).getByRole("textbox"), "EVT-2026-0001");
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(dialog).not.toHaveAttribute("open");
    expect(action).not.toHaveBeenCalled();
    await openDialog();
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("shows a server error inside the dialog", async () => {
    setup(
      vi
        .fn<Action>()
        .mockResolvedValue({ status: "error", message: "Only the event's Owner can delete it." }),
    );
    const dialog = await openDialog();
    await userEvent.type(within(dialog).getByRole("textbox"), "EVT-2026-0001");
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete event" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Only the event's Owner");
    expect(within(dialog).getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
  });
});