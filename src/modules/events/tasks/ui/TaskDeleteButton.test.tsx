// src/modules/events/tasks/ui/TaskDeleteButton.test.tsx
// Deleting a task (B6-F03; D-095): the button asks first in a dialog that names the task and says it
// can't be undone; cancelling removes nothing; a refusal is announced and nothing is removed.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskDeleteState } from "../form-state";
import { TaskDeleteButton } from "./TaskDeleteButton";

const action = vi.fn<() => Promise<TaskDeleteState>>();

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

const renderButton = () =>
  render(<TaskDeleteButton action={action} reference="TSK-0004" title="Confirm florist" />);

describe("TaskDeleteButton", () => {
  it("has an accessible name that says which task", () => {
    renderButton();
    expect(screen.getByRole("button", { name: "Delete TSK-0004 Confirm florist" })).toBeVisible();
  });

  it("deletes nothing until confirmed", async () => {
    renderButton();
    await userEvent.click(screen.getByRole("button", { name: /Delete TSK-0004/ }));
    expect(action).not.toHaveBeenCalled();
  });

  it("asks first, naming the task and saying it can't be undone", async () => {
    renderButton();
    await userEvent.click(screen.getByRole("button", { name: /Delete TSK-0004/ }));
    const dialog = await screen.findByRole("alertdialog", { name: "Delete TSK-0004?" });
    expect(dialog).toHaveTextContent("Confirm florist");
    expect(dialog).toHaveTextContent("can’t undo");
  });

  it("removes nothing when the user keeps the task", async () => {
    renderButton();
    await userEvent.click(screen.getByRole("button", { name: /Delete TSK-0004/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Keep task" }));
    expect(action).not.toHaveBeenCalled();
  });

  it("runs the bound action once on confirm", async () => {
    action.mockResolvedValue({ status: "idle" });
    renderButton();
    await userEvent.click(screen.getByRole("button", { name: /Delete TSK-0004/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Delete task" }));
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("announces a refusal and leaves the task in place", async () => {
    action.mockResolvedValue({
      status: "error",
      message: "Only Owners and Coordinators can change tasks.",
    });
    renderButton();
    await userEvent.click(screen.getByRole("button", { name: /Delete TSK-0004/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Delete task" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Only Owners and Coordinators");
  });
});