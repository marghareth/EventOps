// src/modules/events/suppliers/ui/SupplierForm.test.tsx
// The supplier form with the server action mocked (B4-03, edit mode B4-04): labels, required
// fields, the category list in canonical order, "What they provide" only for Other, accessible
// errors tied to their fields, kept input after a refusal, the failure banner, and editing from the
// stored values with the version sent back.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SUPPLIER_CATEGORIES, SUPPLIER_CATEGORY_DEFINITIONS } from "../categories";
import type { SupplierFormState } from "../form-state";
import { SupplierForm } from "./SupplierForm";

type Action = (s: SupplierFormState, f: FormData) => Promise<SupplierFormState>;
const LIST = "/events/e1/suppliers";

describe("SupplierForm", () => {
  it("labels every field, marks name and category required, and sends what was entered", async () => {
    const action = vi.fn<Action>().mockResolvedValue({ status: "idle" });
    render(<SupplierForm action={action} cancelHref={LIST} />);

    expect(screen.getByLabelText(/^Name/)).toHaveAttribute("aria-required", "true");
    expect(screen.getByLabelText(/^Category/)).toHaveAttribute("aria-required", "true");
    await userEvent.type(screen.getByLabelText(/^Name/), "Garden Kitchen");
    await userEvent.selectOptions(screen.getByLabelText(/^Category/), "Catering");
    await userEvent.type(screen.getByLabelText(/^Contact person/), "Liza Tan");
    await userEvent.type(screen.getByLabelText(/^Phone/), "0917 555 0101");
    await userEvent.type(screen.getByLabelText(/^Email/), "liza@gardenkitchen.ph");
    await userEvent.type(screen.getByLabelText(/^Notes/), "Tasting on Nov 3");
    await userEvent.click(screen.getByRole("button", { name: "Add supplier" }));

    expect(Object.fromEntries(action.mock.calls[0][1])).toEqual({
      name: "Garden Kitchen",
      category: "CATERING",
      contactName: "Liza Tan",
      phone: "0917 555 0101",
      email: "liza@gardenkitchen.ph",
      notes: "Tasting on Nov 3",
    });
  });

  it("offers the canonical categories in order, and describes the chosen one", async () => {
    render(<SupplierForm action={vi.fn<Action>()} cancelHref={LIST} />);
    const options = screen.getAllByRole("option").filter((o) => !(o as HTMLOptionElement).disabled);
    expect(options.map((o) => (o as HTMLOptionElement).value)).toEqual([...SUPPLIER_CATEGORIES]);
    expect(options.map((o) => o.textContent)).toEqual(
      SUPPLIER_CATEGORIES.map((c) => SUPPLIER_CATEGORY_DEFINITIONS[c].label),
    );
    await userEvent.selectOptions(screen.getByLabelText(/^Category/), "Rentals");
    expect(screen.getByLabelText(/^Category/)).toHaveAccessibleDescription(
      "Tables, chairs, tents, linens and other equipment.",
    );
  });

  it("asks what the supplier provides only for Other", async () => {
    const action = vi.fn<Action>().mockResolvedValue({ status: "idle" });
    render(<SupplierForm action={action} cancelHref={LIST} />);
    expect(screen.queryByLabelText(/^What they provide/)).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText(/^Category/), "Other");
    const detail = screen.getByLabelText(/^What they provide/);
    expect(detail).toHaveAttribute("aria-required", "true");
    expect(detail).toHaveAttribute("maxLength", "60");
    await userEvent.type(screen.getByLabelText(/^Name/), "Sparkle Lights");
    await userEvent.type(detail, "Fireworks");
    await userEvent.click(screen.getByRole("button", { name: "Add supplier" }));
    expect(action.mock.calls[0][1].get("categoryDetail")).toBe("Fireworks");

    await userEvent.selectOptions(screen.getByLabelText(/^Category/), "Venue");
    expect(screen.queryByLabelText(/^What they provide/)).not.toBeInTheDocument();
  });

  it("shows the server's errors beside their fields and in a summary, keeping what was typed", async () => {
    const action = vi.fn<Action>().mockResolvedValue({
      status: "error",
      fieldErrors: {
        name: "Enter the supplier's name.",
        email: "Enter an email like name@example.com.",
      },
      values: { name: "", category: "CATERING", email: "liza@", contactName: "Liza Tan" },
    });
    render(<SupplierForm action={action} cancelHref={LIST} />);
    await userEvent.click(screen.getByRole("button", { name: "Add supplier" }));

    // Wait for the server's answer to re-render the form before reading the fields.
    await screen.findByRole("link", { name: "Enter the supplier's name." });
    const email = screen.getByLabelText(/^Email/);
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAccessibleDescription(/Enter an email like name@example.com./);
    expect(email).toHaveValue("liza@");
    expect(screen.getByLabelText(/^Name/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(/^Category/)).toHaveValue("CATERING");
    expect(screen.getByLabelText(/^Contact person/)).toHaveValue("Liza Tan");
    expect(screen.getByRole("link", { name: "Enter the supplier's name." })).toHaveAttribute(
      "href",
      "#add-supplier-name",
    );
  });

  it("shows a refusal from the server as a banner", async () => {
    const action = vi.fn<Action>().mockResolvedValue({
      status: "error",
      message: "Your role can view suppliers but not change them. Ask an Owner or Coordinator.",
    });
    render(<SupplierForm action={action} cancelHref={LIST} />);
    await userEvent.click(screen.getByRole("button", { name: "Add supplier" }));
    expect(await screen.findByText("Couldn't add the supplier")).toBeVisible();
    expect(screen.getByText(/Your role can view suppliers/)).toBeVisible();
  });

  it("asks for business contact details, and says every member can see them (B4-06)", () => {
    render(<SupplierForm action={vi.fn<Action>()} cancelHref={LIST} />);
    expect(screen.getByRole("group", { name: "Contact (optional)" })).toHaveAccessibleDescription(
      "Use the supplier's business contact details. Every member of the event can see them.",
    );
  });

  it("tells who can see notes, and links Cancel to the supplier list", () => {
    render(<SupplierForm action={vi.fn<Action>()} cancelHref={LIST} />);
    expect(screen.getByLabelText(/^Notes/)).toHaveAccessibleDescription(
      /Every member of the event can see notes\. Up to 2,000 characters\./,
    );
    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute("href", LIST);
  });

  describe("in edit mode", () => {
    const saved = {
      name: "Sparkle Lights",
      category: "OTHER",
      categoryDetail: "Fireworks",
      contactName: "",
      email: "",
      phone: "0917 555 0104",
      notes: "",
    };
    const VERSION = "2026-10-14T04:00:00.000Z";

    it("starts from the stored values and sends them back with the version", async () => {
      const action = vi.fn<Action>().mockResolvedValue({ status: "idle" });
      render(
        <SupplierForm
          action={action}
          cancelHref={LIST}
          mode="edit"
          saved={saved}
          version={VERSION}
        />,
      );
      expect(screen.getByLabelText(/^Name/)).toHaveValue("Sparkle Lights");
      expect(screen.getByLabelText(/^Category/)).toHaveValue("OTHER");
      expect(screen.getByLabelText(/^What they provide/)).toHaveValue("Fireworks");
      expect(screen.getByLabelText(/^Phone/)).toHaveValue("0917 555 0104");
      await userEvent.clear(screen.getByLabelText(/^Name/));
      await userEvent.type(screen.getByLabelText(/^Name/), "Sparkle Lights PH");
      await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
      const sent = action.mock.calls[0][1];
      expect(sent.get("name")).toBe("Sparkle Lights PH");
      expect(sent.get("categoryDetail")).toBe("Fireworks");
      expect(sent.get("version")).toBe(VERSION);
    });

    it("says when there was nothing to save, and shows a stale save as a banner", async () => {
      const action = vi
        .fn<Action>()
        .mockResolvedValueOnce({ status: "success", message: "No changes to save." })
        .mockResolvedValueOnce({
          status: "error",
          message: "This supplier changed since you opened it.",
          values: saved,
        });
      render(
        <SupplierForm
          action={action}
          cancelHref={LIST}
          mode="edit"
          saved={saved}
          version={VERSION}
        />,
      );
      await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
      expect(await screen.findByText("No changes to save.")).toBeVisible();
      await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
      expect(await screen.findByText("Couldn't save the changes")).toBeVisible();
      expect(screen.getByText("This supplier changed since you opened it.")).toBeVisible();
    });
  });
});