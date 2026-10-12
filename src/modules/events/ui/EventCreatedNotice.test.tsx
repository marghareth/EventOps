// src/modules/events/ui/EventCreatedNotice.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { EventCreatedNotice } from "./EventCreatedNotice";

it("confirms the new event's reference and can be dismissed", async () => {
  render(<EventCreatedNotice reference="EVT-2026-0001" />);
  expect(screen.getByText("Event created")).toBeInTheDocument();
  expect(screen.getByText("EVT-2026-0001")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /dismiss/i }));
  expect(screen.queryByText("Event created")).not.toBeInTheDocument();
});