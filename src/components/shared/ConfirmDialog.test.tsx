// src/components/shared/ConfirmDialog.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";

// jsdom does not implement the modal methods of <dialog>, so give it the minimal behavior.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});

function setup(props: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ConfirmDialog
      open
      title="Delete this event?"
      description="This removes all guests and cannot be undone."
      confirmLabel="Delete event"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    />,
  );
  return { onConfirm, onCancel };
}

describe("ConfirmDialog", () => {
  it("is not visible to assistive technology when closed", () => {
    setup({ open: false });
    expect(screen.queryByRole("dialog", { hidden: false })).not.toBeInTheDocument();
  });

  it("shows an accessible name and description when open", () => {
    setup();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAccessibleName("Delete this event?");
    expect(dialog).toHaveAccessibleDescription("This removes all guests and cannot be undone.");
  });

  it("calls onConfirm and onCancel from the buttons", async () => {
    const { onConfirm, onCancel } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Delete event" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("uses alertdialog and starts focus on Cancel when destructive", () => {
    setup({ destructive: true });
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("starts focus on the confirm button when not destructive", () => {
    setup({ confirmLabel: "Save changes" });
    expect(screen.getByRole("button", { name: "Save changes" })).toHaveFocus();
  });

  it("treats Escape as cancel", () => {
    const { onCancel } = setup();
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("locks the buttons and ignores Escape while pending", () => {
    const { onCancel } = setup({ pending: true });
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Working…" })).toBeDisabled();
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("supports custom labels", () => {
    setup({ cancelLabel: "Keep event" });
    expect(screen.getByRole("button", { name: "Keep event" })).toBeInTheDocument();
  });
});