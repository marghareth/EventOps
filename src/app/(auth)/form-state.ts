// src/app/(auth)/form-state.ts
// State shared by the auth forms and their server actions. Lives outside actions.ts because a
// "use server" file may only export async functions.

type AuthField = "displayName" | "email" | "password";

export type AuthFormState = {
  status: "idle" | "error" | "check-email";
  /** Form-level message, already safe to show. */
  message?: string;
  fieldErrors?: Partial<Record<AuthField, string>>;
  /** Values to put back in the form. Never includes the password. */
  values?: { email?: string; displayName?: string };
};

export const initialAuthFormState: AuthFormState = { status: "idle" };