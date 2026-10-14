// src/modules/events/accessibility/ui/RemoveResourceSection.test.tsx
// Removing a resource (B3-05) with the server action mocked: nothing happens until confirmed.
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { RemoveFormState } from "../form-state";
import { RemoveResourceSection } from "./RemoveResourceSection";

type Action = (s: RemoveFormState, f: FormData) => Promise<RemoveFormState>;

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});

describe("RemoveResourceSection", () => {
  it("removes nothing until confirmed, then calls the action once", async () => {
    const action = vi.fn<Action>().mockResolvedValue({ status: "idle" });
    render(<RemoveResourceSection action={action} label="Ramp or elevator" />);
    await userEvent.click(screen.getByRole("button", { name: "Remove resource" }));
    const dialog = screen.getByRole("alertdialog", { name: "Remove this resource?" });
    expect(dialog).toHaveAccessibleDescription(
      "Ramp or elevator will show as Not set up again. You can't undo this.",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(action).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Remove resource" }));
    await userEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Remove resource" }),
    );
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
  });
});