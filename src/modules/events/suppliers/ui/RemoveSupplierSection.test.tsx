// src/modules/events/suppliers/ui/RemoveSupplierSection.test.tsx
// Remove supplier (B4-05, D-072; B10-F09): the shared confirm dialog names the supplier and says it
// can't be undone, starts on Cancel, removes nothing when cancelled, and shows a refusal. This file
// held a copy of the component instead of tests; replaced in B10.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { DeleteSupplierFormState } from "../form-state";
import { RemoveSupplierSection } from "./RemoveSupplierSection";

const action =
  vi.fn<(s: DeleteSupplierFormState, f: FormData) => Promise<DeleteSupplierFormState>>();

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
});
beforeEach(() => action.mockReset());

const renderSection = () =>
  render(<RemoveSupplierSection action={action} name="Bloom Co." reference="SUP-0003" />);

describe("RemoveSupplierSection", () => {
  it("is a labelled section that says removing can't be undone", () => {
    renderSection();
    expect(screen.getByRole("region", { name: "Remove supplier" })).toHaveTextContent(
      "You can't undo this.",
    );
  });

  it("asks first with focus on Cancel, and cancelling removes nothing", async () => {
    renderSection();
    await userEvent.click(screen.getByRole("button", { name: "Remove supplier" }));
    const dialog = screen.getByRole("alertdialog", { name: "Remove this supplier?" });
    expect(dialog).toHaveTextContent("Bloom Co. (SUP-0003) will be removed");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(action).not.toHaveBeenCalled();
  });

  it("removes on confirm and shows a refusal in the dialog", async () => {
    action.mockResolvedValue({ status: "error", message: "We couldn't remove the supplier." });
    renderSection();
    await userEvent.click(screen.getByRole("button", { name: "Remove supplier" }));
    const buttons = screen.getAllByRole("button", { name: "Remove supplier" });
    await userEvent.click(buttons[buttons.length - 1]!);
    expect(action).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't remove the supplier.");
  });
});