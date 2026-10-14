// src/modules/events/accessibility/ui/RemoveRequirementSection.test.tsx
// Removing an accessibility need (B3-04) with the server action mocked: nothing is removed without
// confirming, Cancel removes nothing, and an error stays inside the dialog.
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { RemoveFormState } from "../form-state";
import { RemoveRequirementSection } from "./RemoveRequirementSection";

type Action = (s: RemoveFormState, f: FormData) => Promise<RemoveFormState>;

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
  render(
    <RemoveRequirementSection action={action} label="Captioning" attendeeName="Maria Santos" />,
  );
  return action;
}

const open = async () => {
  await userEvent.click(screen.getByRole("button", { name: "Remove need" }));
  return screen.getByRole("alertdialog", { name: "Remove this accessibility need?" });
};

describe("RemoveRequirementSection", () => {
  it("is a labelled region that removes nothing until confirmed", async () => {
    const action = setup();
    expect(screen.getByRole("region", { name: "Remove this need" })).toBeVisible();
    const dialog = await open();
    expect(dialog).toHaveAccessibleDescription(
      "Captioning will be removed from Maria Santos's accessibility needs. You can't undo this.",
    );
    expect(action).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(action).not.toHaveBeenCalled();
  });

  it("removes when confirmed, and shows a failure inside the dialog", async () => {
    const action = setup(
      vi.fn<Action>().mockResolvedValue({ status: "error", message: "We couldn't remove it." }),
    );
    const dialog = await open();
    await userEvent.click(within(dialog).getByRole("button", { name: "Remove need" }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("We couldn't remove it.");
  });
});