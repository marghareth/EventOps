// src/modules/events/suppliers/ui/QuoteForm.test.tsx
// The quote form with the server action mocked (B4-09; edit mode B4-10): labelled fields, the canonical statuses in
// order with the chosen one's meaning, Pending by default, what was typed sent as typed (the server
// parses the amount), the server's field errors kept beside their fields, and the failure banner.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { QuoteFormState } from "../quote-form-state";
import { QUOTE_STATUSES, QUOTE_STATUS_DEFINITIONS } from "../quote-statuses";
import { QuoteForm } from "./QuoteForm";

type Action = (s: QuoteFormState, f: FormData) => Promise<QuoteFormState>;
const BACK = "/events/e1/suppliers/s1";

describe("QuoteForm", () => {
  it("labels the fields, starts Pending, and sends what was entered", async () => {
    const action = vi.fn<Action>().mockResolvedValue({ status: "idle" });
    render(<QuoteForm action={action} cancelHref={BACK} />);
    const amount = screen.getByLabelText(/^Amount/);
    expect(amount).toHaveAttribute("aria-required", "true");
    expect(amount).toHaveAttribute("inputmode", "decimal");
    expect(amount).toHaveAccessibleDescription("In pesos, for example 120,000 or 120,000.50.");
    expect(screen.getByLabelText(/^Status/)).toHaveValue("PENDING");
    await userEvent.type(amount, "165,000.50");
    await userEvent.type(screen.getByLabelText(/^Description/), "Buffet, 220 guests");
    await userEvent.click(screen.getByRole("button", { name: "Add quote" }));
    expect(Object.fromEntries(action.mock.calls[0][1])).toEqual({
      amount: "165,000.50",
      status: "PENDING",
      description: "Buffet, 220 guests",
    });
    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute("href", BACK);
  });

  it("offers the canonical statuses in order, and describes the chosen one", async () => {
    render(<QuoteForm action={vi.fn<Action>()} cancelHref={BACK} />);
    const options = screen.getAllByRole("option") as HTMLOptionElement[];
    expect(options.map((o) => o.value)).toEqual([...QUOTE_STATUSES]);
    expect(options.map((o) => o.textContent)).toEqual(
      QUOTE_STATUSES.map((s) => QUOTE_STATUS_DEFINITIONS[s].label),
    );
    await userEvent.selectOptions(screen.getByLabelText(/^Status/), "Accepted");
    expect(screen.getByLabelText(/^Status/)).toHaveAccessibleDescription(
      QUOTE_STATUS_DEFINITIONS.ACCEPTED.description,
    );
  });

  it("shows the server's errors beside their fields and in a summary, keeping what was typed", async () => {
    const action = vi.fn<Action>().mockResolvedValue({
      status: "error",
      fieldErrors: {
        amount: "Use at most two decimal places (centavos).",
        status:
          "QUO-0002 is already accepted for this supplier. Change it to Pending or Declined first.",
      },
      values: { amount: "1.005", status: "ACCEPTED", description: "Buffet" },
    });
    render(<QuoteForm action={action} cancelHref={BACK} />);
    await userEvent.click(screen.getByRole("button", { name: "Add quote" }));
    await screen.findByRole("link", { name: "Use at most two decimal places (centavos)." });
    const amount = screen.getByLabelText(/^Amount/);
    expect(amount).toHaveAttribute("aria-invalid", "true");
    expect(amount).toHaveValue("1.005");
    const status = screen.getByLabelText(/^Status/);
    expect(status).toHaveValue("ACCEPTED");
    expect(status).toHaveAccessibleDescription(/QUO-0002 is already accepted/);
    expect(screen.getByLabelText(/^Description/)).toHaveValue("Buffet");
  });

  it("shows a refusal from the server as a banner", async () => {
    const action = vi.fn<Action>().mockResolvedValue({
      status: "error",
      message: "This supplier isn't available. They may have been removed.",
    });
    render(<QuoteForm action={action} cancelHref={BACK} />);
    await userEvent.type(screen.getByLabelText(/^Amount/), "1000");
    await userEvent.click(screen.getByRole("button", { name: "Add quote" }));
    expect(await screen.findByText("Couldn't add the quote")).toBeVisible();
    expect(screen.getByText(/They may have been removed/)).toBeVisible();
  });

  describe("in edit mode", () => {
    const saved = { amount: "165,000.50", status: "ACCEPTED", description: "Buffet" };
    const VERSION = "2026-10-14T04:00:00.000Z";

    it("starts from the stored values and sends them back with the version", async () => {
      const action = vi.fn<Action>().mockResolvedValue({ status: "idle" });
      render(
        <QuoteForm action={action} cancelHref={BACK} mode="edit" saved={saved} version={VERSION} />,
      );
      expect(screen.getByLabelText(/^Amount/)).toHaveValue("165,000.50");
      expect(screen.getByLabelText(/^Status/)).toHaveValue("ACCEPTED");
      expect(screen.getByLabelText(/^Description/)).toHaveValue("Buffet");
      await userEvent.selectOptions(screen.getByLabelText(/^Status/), "Declined");
      await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
      expect(Object.fromEntries(action.mock.calls[0][1])).toEqual({
        version: VERSION,
        amount: "165,000.50",
        status: "DECLINED",
        description: "Buffet",
      });
    });

    it("says when there was nothing to save, and shows a stale save as a banner", async () => {
      const action = vi
        .fn<Action>()
        .mockResolvedValueOnce({ status: "success", message: "No changes to save." })
        .mockResolvedValueOnce({
          status: "error",
          message: "This quote changed since you opened it.",
          values: saved,
        });
      render(
        <QuoteForm action={action} cancelHref={BACK} mode="edit" saved={saved} version={VERSION} />,
      );
      await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
      expect(await screen.findByText("No changes to save.")).toBeVisible();
      await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
      expect(await screen.findByText("Couldn't save the changes")).toBeVisible();
    });
  });
});