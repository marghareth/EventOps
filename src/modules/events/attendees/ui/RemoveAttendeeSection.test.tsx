// src/modules/events/attendees/ui/RemoveAttendeeSection.test.tsx
// Remove attendee confirmation (B2-04) with the server action mocked: nothing is removed without
// confirming, Cancel and Escape remove nothing, the working state, and errors inside the dialog.
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { DeleteAttendeeFormState } from "../form-state";
import { RemoveAttendeeSection } from "./RemoveAttendeeSection";

type Action = (s: DeleteAttendeeFormState, f: FormData) => Promise<DeleteAttendeeFormState>;

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
  render(<RemoveAttendeeSection action={action} name="Maria Santos" reference="ATT-0003" />);
  return action;
}

async function openDialog() {
  await userEvent.click(screen.getByRole("button", { name: "Remove attendee" }));
  return screen.getByRole("alertdialog", { name: "Remove this attendee?" });
}

describe("RemoveAttendeeSection", () => {
  it("removes nothing until confirmed, and names the attendee in the dialog", async () => {
    const action = setup();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    const dialog = await openDialog();
    expect(dialog).toHaveAccessibleDescription(
      "Maria Santos (ATT-0003) will be removed from the guest list. You can't undo this.",
    );
    expect(action).not.toHaveBeenCalled();
  });

  it("starts on Cancel, the safe choice", async () => {
    setup();
    const dialog = await openDialog();
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("Cancel closes the dialog and removes nothing", async () => {
    const action = setup();
    const dialog = await openDialog();
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(dialog).not.toHaveAttribute("open");
    expect(action).not.toHaveBeenCalled();
  });

  it("Escape closes the dialog and removes nothing", async () => {
    const action = setup();
    const dialog = await openDialog();
    dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
    await waitFor(() => expect(dialog).not.toHaveAttribute("open"));
    expect(action).not.toHaveBeenCalled();
  });

  it("confirming calls the action once and shows that it is working", async () => {
    let finish: (state: DeleteAttendeeFormState) => void = () => {};
    const action = setup(vi.fn<Action>(() => new Promise((resolve) => (finish = resolve))));
    const dialog = await openDialog();
    await userEvent.click(within(dialog).getByRole("button", { name: "Remove attendee" }));
    const working = await within(dialog).findByRole("button", { name: "Working…" });
    expect(working).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(action).toHaveBeenCalledOnce();
    finish({ status: "idle" });
  });

  it("shows a failure inside the dialog, which stays open", async () => {
    setup(
      vi.fn<Action>().mockResolvedValue({
        status: "error",
        message: "This attendee isn't available. They may have been removed.",
      }),
    );
    const dialog = await openDialog();
    await userEvent.click(within(dialog).getByRole("button", { name: "Remove attendee" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("may have been removed");
    expect(dialog).toHaveAttribute("open");
  });
});