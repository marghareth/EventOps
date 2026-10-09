// src/app/(auth)/_components/forms.test.tsx
// Sign-in and sign-up forms with the server actions mocked: labels, accessible errors and the
// "check your email" state.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthFormState } from "../form-state";

const signInAction = vi.fn<(s: AuthFormState, f: FormData) => Promise<AuthFormState>>();
const signUpAction = vi.fn<(s: AuthFormState, f: FormData) => Promise<AuthFormState>>();

vi.mock("../actions", () => ({
  signInAction: (s: AuthFormState, f: FormData) => signInAction(s, f),
  signUpAction: (s: AuthFormState, f: FormData) => signUpAction(s, f),
}));

const { SignInForm } = await import("./SignInForm");
const { SignUpForm } = await import("./SignUpForm");

beforeEach(() => {
  signInAction.mockReset();
  signUpAction.mockReset();
});

describe("SignInForm", () => {
  it("labels every field and sends the next path", async () => {
    signInAction.mockResolvedValue({ status: "idle" });
    render(<SignInForm next="/events/4" />);
    await userEvent.type(screen.getByLabelText(/Email/), "mika@example.com");
    await userEvent.type(screen.getByLabelText(/Password/), "secret");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    const data = signInAction.mock.calls[0][1];
    expect(data.get("email")).toBe("mika@example.com");
    expect(data.get("password")).toBe("secret");
    expect(data.get("next")).toBe("/events/4");
  });

  it("shows field errors on the controls and in a summary", async () => {
    signInAction.mockResolvedValue({
      status: "error",
      fieldErrors: { email: "Enter your email address." },
    });
    render(<SignInForm next="/events" />);
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    const email = await screen.findByLabelText(/Email/);
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAccessibleDescription(/Enter your email address\./);
    expect(screen.getByRole("link", { name: "Enter your email address." })).toBeInTheDocument();
  });

  it("announces a form-level error as an alert and keeps the email", async () => {
    signInAction.mockResolvedValue({
      status: "error",
      message: "Email or password is incorrect.",
      values: { email: "mika@example.com" },
    });
    render(<SignInForm next="/events" />);
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Email or password is incorrect.");
    expect(screen.getByLabelText(/Email/)).toHaveValue("mika@example.com");
    expect(screen.getByLabelText(/Password/)).toHaveValue("");
  });
});

describe("SignUpForm", () => {
  it("shows the password rule as a hint", () => {
    render(<SignUpForm next="/events" />);
    expect(screen.getByLabelText(/Password/)).toHaveAccessibleDescription("At least 8 characters.");
  });

  it("replaces the form with a 'check your email' message", async () => {
    signUpAction.mockResolvedValue({
      status: "check-email",
      values: { email: "mika@example.com" },
    });
    render(<SignUpForm next="/events" />);
    await userEvent.type(screen.getByLabelText(/Name/), "Mika");
    await userEvent.type(screen.getByLabelText(/Email/), "mika@example.com");
    await userEvent.type(screen.getByLabelText(/Password/), "12345678");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Check your email");
    expect(screen.queryByRole("button", { name: "Create account" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to sign in" })).toHaveAttribute("href", "/login");
  });
});