// src/modules/events/budget/ui/DeleteButton.test.tsx
// Deleting a budget category or item (B5-F01, B5-F02; B10-F09, D-114): the shared confirm dialog
// names the record and says it can't be undone, focus starts on the safe choice, cancelling removes
// nothing, and a refusal is announced.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { DeleteFormState } from "../form-state";
import { DeleteButton } from "./DeleteButton";

const action = vi.fn<() => Promise<DeleteFormState>>();

// jsdom has no <dialog> modal support: give it the minimum the shared dialog uses.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
});
beforeEach(() => action.mockReset());

describe("budget DeleteButton", () => {
  it("names the item, asks in a dialog with focus on Keep, and deletes only on confirm", async () => {
    action.mockResolvedValue(undefined as never);
    render(<DeleteButton kind="item" label="BUD-0004 Venue deposit" action={action} />);
    await userEvent.click(screen.getByRole("button", { name: "Delete BUD-0004 Venue deposit" }));
    const dialog = screen.getByRole("alertdialog", { name: "Delete BUD-0004 Venue deposit?" });
    expect(dialog).toHaveTextContent("You can't undo this.");
    expect(screen.getByRole("button", { name: "Keep item" })).toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: "Keep item" }));
    expect(action).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Delete BUD-0004 Venue deposit" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete item" }));
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("announces a refusal, for example a category that still has items", async () => {
    action.mockResolvedValue({
      status: "error",
      message: "Move or delete this category's items first.",
    });
    render(<DeleteButton kind="category" label="Catering" action={action} />);
    await userEvent.click(screen.getByRole("button", { name: "Delete category Catering" }));
    expect(
      screen.getByRole("alertdialog", { name: "Delete the category Catering?" }),
    ).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Delete category" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Move or delete this category's items first.",
    );
  });
});