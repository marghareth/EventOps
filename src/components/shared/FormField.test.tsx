// src/components/shared/FormField.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { FormErrorSummary } from "./FormErrorSummary";
import { FormField, fieldControlClass } from "./FormField";

describe("FormField", () => {
  it("connects the label to the control", () => {
    render(<FormField label="Name">{(c) => <input {...c} />}</FormField>);
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
  });

  it("marks the control valid when there is no error", () => {
    render(<FormField label="Name">{(c) => <input {...c} />}</FormField>);
    expect(screen.getByLabelText("Name")).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByText(/Error:/)).not.toBeInTheDocument();
  });

  it("marks the control invalid and links the error message", () => {
    render(
      <FormField label="Name" error="Enter a name">
        {(c) => <input {...c} />}
      </FormField>,
    );
    const input = screen.getByLabelText("Name");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(/^Error:\s*Enter a name$/);
  });

  it("describes the control with both hint and error", () => {
    render(
      <FormField label="Name" hint="As on the invitation" error="Enter a name">
        {(c) => <input {...c} />}
      </FormField>,
    );
    expect(screen.getByLabelText("Name")).toHaveAccessibleDescription(
      /^As on the invitation Error:\s*Enter a name$/,
    );
  });

  it("announces required fields without relying on the asterisk", () => {
    render(
      <FormField label="Name" required>
        {(c) => <input {...c} />}
      </FormField>,
    );
    expect(screen.getByLabelText(/Name/)).toHaveAttribute("aria-required", "true");
    expect(screen.getByText("(required)")).toBeInTheDocument();
  });

  it("uses a given id", () => {
    render(
      <FormField label="Name" id="event-name">
        {(c) => <input {...c} />}
      </FormField>,
    );
    expect(screen.getByLabelText("Name")).toHaveAttribute("id", "event-name");
  });
});

describe("fieldControlClass", () => {
  it("styles the invalid state from aria-invalid and keeps a 44 px target", () => {
    expect(fieldControlClass).toContain("aria-invalid:border-critical");
    expect(fieldControlClass).toContain("aria-invalid:bg-critical-tint");
    expect(fieldControlClass).toContain("min-h-11");
  });

  it("can be applied to a control inside a field", () => {
    render(
      <FormField label="Name" error="Enter a name">
        {(c) => <input {...c} className={fieldControlClass} />}
      </FormField>,
    );
    expect(screen.getByLabelText("Name")).toHaveClass("aria-invalid:border-critical");
  });
});

describe("FormErrorSummary", () => {
  it("renders nothing when there are no errors", () => {
    const { container } = render(<FormErrorSummary errors={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists every error and takes focus", () => {
    render(
      <FormErrorSummary
        errors={[
          { fieldId: "name", message: "Enter a name" },
          { fieldId: "date", message: "Pick a date" },
        ]}
      />,
    );
    const group = screen.getByRole("group", { name: "Fix these to continue" });
    expect(group).toHaveFocus();
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("moves focus to the field when an error is activated", async () => {
    render(
      <>
        <FormErrorSummary errors={[{ fieldId: "name", message: "Enter a name" }]} />
        <FormField label="Name" id="name" error="Enter a name">
          {(c) => <input {...c} />}
        </FormField>
      </>,
    );
    await userEvent.click(screen.getByRole("link", { name: "Enter a name" }));
    expect(screen.getByLabelText("Name")).toHaveFocus();
  });
});