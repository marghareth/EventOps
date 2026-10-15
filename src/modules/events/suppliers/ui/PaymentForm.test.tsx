// src/modules/events/suppliers/ui/PaymentForm.test.tsx
// The payment form with the server action mocked (B4-14): labelled fields with the canonical kinds
// and statuses, Unpaid by default with no paid date, the paid date only for Paid (limited to the
// server's today), what was typed sent as typed, server errors kept beside their fields, and edit
// mode with the version.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  PAYMENT_KINDS,
  PAYMENT_KIND_DEFINITIONS,
  PAYMENT_RECORD_STATUSES,
  PAYMENT_RECORD_STATUS_DEFINITIONS,
} from "../payment-definitions";
import type { PaymentFormState } from "../payment-form-state";
import { PaymentForm } from "./PaymentForm";

type Action = (s: PaymentFormState, f: FormData) => Promise<PaymentFormState>;
const BACK = "/events/e1/suppliers/s1";
const TODAY = "2026-10-14";

describe("PaymentForm", () => {
  it("offers the canonical kinds and statuses, starting Deposit and Not paid yet", () => {
    render(<PaymentForm action={vi.fn<Action>()} cancelHref={BACK} today={TODAY} />);
    const kind = screen.getByLabelText(/^Kind/) as HTMLSelectElement;
    expect([...kind.options].map((o) => o.value)).toEqual([...PAYMENT_KINDS]);
    expect([...kind.options].map((o) => o.textContent)).toEqual(
      PAYMENT_KINDS.map((k) => PAYMENT_KIND_DEFINITIONS[k].label),
    );
    expect(kind).toHaveValue("DEPOSIT");
    const status = screen.getByLabelText(/^Status/) as HTMLSelectElement;
    expect([...status.options].map((o) => o.value)).toEqual([...PAYMENT_RECORD_STATUSES]);
    expect([...status.options].map((o) => o.textContent)).toEqual(
      PAYMENT_RECORD_STATUSES.map((s) => PAYMENT_RECORD_STATUS_DEFINITIONS[s].label),
    );
    expect(status).toHaveValue("UNPAID");
    expect(screen.queryByLabelText(/^Paid on/)).not.toBeInTheDocument();
    const due = screen.getByLabelText(/^Due date/);
    expect(due).toHaveAttribute("type", "date");
    expect(due).toHaveAttribute("min", "2000-01-01");
    expect(due).toHaveAttribute("max", "2100-12-31");
  });

  it("asks for the paid date only for Paid, up to today, and sends what was entered", async () => {
    const action = vi.fn<Action>().mockResolvedValue({ status: "idle" });
    render(<PaymentForm action={action} cancelHref={BACK} today={TODAY} />);
    await userEvent.type(screen.getByLabelText(/^Amount/), "49,500");
    await userEvent.type(screen.getByLabelText(/^Due date/), "2026-10-05");
    await userEvent.selectOptions(screen.getByLabelText(/^Status/), "Paid");
    const paidOn = screen.getByLabelText(/^Paid on/);
    expect(paidOn).toHaveAttribute("aria-required", "true");
    expect(paidOn).toHaveAttribute("max", TODAY);
    await userEvent.type(paidOn, "2026-10-03");
    await userEvent.type(screen.getByLabelText(/^Description/), "30% deposit");
    await userEvent.click(screen.getByRole("button", { name: "Add payment" }));
    expect(Object.fromEntries(action.mock.calls[0][1])).toEqual({
      kind: "DEPOSIT",
      amount: "49,500",
      dueDate: "2026-10-05",
      status: "PAID",
      paidOn: "2026-10-03",
      description: "30% deposit",
    });
  });

  it("shows the server's errors beside their fields, keeping what was typed", async () => {
    const action = vi.fn<Action>().mockResolvedValue({
      status: "error",
      fieldErrors: { paidOn: "The paid date can't be in the future." },
      values: {
        kind: "PAYMENT",
        amount: "1000",
        dueDate: "2026-10-05",
        status: "PAID",
        paidOn: "2026-10-20",
        description: "",
      },
    });
    render(<PaymentForm action={action} cancelHref={BACK} today={TODAY} />);
    await userEvent.click(screen.getByRole("button", { name: "Add payment" }));
    await screen.findByRole("link", { name: "The paid date can't be in the future." });
    const paidOn = screen.getByLabelText(/^Paid on/);
    expect(paidOn).toHaveAttribute("aria-invalid", "true");
    expect(paidOn).toHaveValue("2026-10-20");
    expect(screen.getByLabelText(/^Kind/)).toHaveValue("PAYMENT");
  });

  it("edits from the stored values and sends the version", async () => {
    const action = vi.fn<Action>().mockResolvedValue({ status: "idle" });
    const saved = {
      kind: "PAYMENT",
      amount: "115,500.00",
      dueDate: "2026-12-05",
      status: "UNPAID",
      paidOn: "",
      description: "Balance",
    };
    render(
      <PaymentForm
        action={action}
        cancelHref={BACK}
        today={TODAY}
        mode="edit"
        saved={saved}
        version="2026-10-14T04:00:00.000Z"
      />,
    );
    expect(screen.getByLabelText(/^Amount/)).toHaveValue("115,500.00");
    expect(screen.getByLabelText(/^Due date/)).toHaveValue("2026-12-05");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(action.mock.calls[0][1].get("version")).toBe("2026-10-14T04:00:00.000Z");
    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute("href", BACK);
  });
});