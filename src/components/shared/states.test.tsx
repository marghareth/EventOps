// src/components/shared/states.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Banner } from "./Banner";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { LoadingState } from "./LoadingState";
import { NotFoundState } from "./NotFoundState";
import { SuccessMessage } from "./SuccessMessage";
import { UnauthorizedState } from "./UnauthorizedState";

describe("LoadingState", () => {
  it("is a status region with a visible label", () => {
    render(<LoadingState label="Loading attendees" />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading attendees");
  });

  it("defaults to a generic label", () => {
    render(<LoadingState />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
  });

  it("hides the spinner icon from assistive technology", () => {
    const { container } = render(<LoadingState />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("EmptyState", () => {
  it("shows the title, description and action", () => {
    render(
      <EmptyState
        title="No suppliers yet"
        description="Import your spreadsheet or add your first supplier."
        action={<button>Add supplier</button>}
      />,
    );
    expect(screen.getByRole("heading", { name: "No suppliers yet" })).toBeInTheDocument();
    expect(screen.getByText(/add your first supplier/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add supplier" })).toBeInTheDocument();
  });

  it("renders without an action", () => {
    render(<EmptyState title="Nothing here" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("uses the requested heading level", () => {
    render(<EmptyState title="Nothing here" headingLevel={3} />);
    expect(screen.getByRole("heading", { level: 3 })).toBeInTheDocument();
  });
});

describe("ErrorState", () => {
  it("is an alert with safe default text", () => {
    render(<ErrorState />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeInTheDocument();
  });

  it("calls onRetry when Try again is pressed", async () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows no retry button without onRetry", () => {
    render(<ErrorState />);
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("shows the support reference when given", () => {
    render(<ErrorState reference="abc123" />);
    expect(screen.getByText("Reference: abc123")).toBeInTheDocument();
  });
});

describe("NotFoundState", () => {
  it("shows the generic message and a link home", () => {
    render(<NotFoundState />);
    expect(screen.getByRole("heading", { level: 1, name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to home" })).toHaveAttribute("href", "/");
  });

  it("names the resource and uses a custom link", () => {
    render(<NotFoundState resource="event" href="/events" linkLabel="Back to my events" />);
    expect(
      screen.getByRole("heading", { name: "We couldn't find this event" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to my events" })).toHaveAttribute(
      "href",
      "/events",
    );
  });
});

describe("UnauthorizedState", () => {
  it("defaults to forbidden and does not offer sign in", () => {
    render(<UnauthorizedState />);
    expect(
      screen.getByRole("heading", { name: "You don't have access to this" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to my events" })).toHaveAttribute(
      "href",
      "/events",
    );
    expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
  });

  it("offers sign in when signed out", () => {
    render(<UnauthorizedState kind="signed-out" />);
    expect(screen.getByRole("heading", { name: "Sign in to continue" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  });
});

describe("SuccessMessage", () => {
  it("is a polite status region with a hidden severity label and the title", () => {
    render(<SuccessMessage title="Import complete">184 guests were added.</SuccessMessage>);
    const region = screen.getByRole("status");
    expect(region).toHaveTextContent("Success: Import complete");
    expect(region).toHaveTextContent("184 guests were added.");
  });

  it("has no buttons unless onDismiss is given", () => {
    render(<SuccessMessage title="Saved" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("calls onDismiss from the Dismiss button", async () => {
    const onDismiss = vi.fn();
    render(<SuccessMessage title="Saved" onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("shows an action next to Dismiss", () => {
    render(
      <SuccessMessage
        title="Saved"
        action={<a href="/rows">Review rows</a>}
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByRole("link", { name: "Review rows" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeInTheDocument();
  });
});

describe("Banner", () => {
  it.each([
    ["success", "Success", "status"],
    ["warning", "Warning", "status"],
    ["info", "Information", "status"],
    ["critical", "Error", "alert"],
  ] as const)("%s banner has a text label and the right live role", (severity, label, role) => {
    render(<Banner severity={severity} title="Something happened" />);
    expect(screen.getByRole(role)).toHaveTextContent(`${label}: Something happened`);
  });

  it("allows the role to be overridden", () => {
    render(<Banner severity="critical" role="status" title="Could not save" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});