// src/app/(auth)/actions.ts
// Sign-up, sign-in and sign-out server actions. Inputs come from the browser, so they are
// validated here with Zod before Supabase sees them. Next.js checks the Origin header of every
// server action request, which protects these forms against cross-site request forgery.
"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { syncUserRecord } from "@/lib/auth";
import {
  AUTH_MESSAGES,
  LOGIN_PATH,
  authErrorMessage,
  fieldErrorsFrom,
  isExistingAccountError,
  safeNextPath,
  signInSchema,
  signUpSchema,
} from "@/lib/auth-rules";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthFormState } from "./form-state";

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function signInAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const raw = { email: text(formData, "email"), password: text(formData, "password") };
  const next = safeNextPath(text(formData, "next"));
  const values = { email: raw.email };

  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    return { status: "error", message: authErrorMessage(error), values };
  }

  try {
    await syncUserRecord(data.user);
  } catch {
    // Without a users row, later membership checks would fail. Undo the sign-in.
    await supabase.auth.signOut({ scope: "local" });
    return { status: "error", message: AUTH_MESSAGES.unavailable, values };
  }

  redirect(next);
}

export async function signUpAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const raw = {
    displayName: text(formData, "displayName"),
    email: text(formData, "email"),
    password: text(formData, "password"),
  };
  const next = safeNextPath(text(formData, "next"));
  const values = { email: raw.email, displayName: raw.displayName };

  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  }

  // Where the confirmation link returns. Supabase only follows URLs on its allow list.
  const origin = (await headers()).get("origin");
  const emailRedirectTo = origin
    ? `${origin}/auth/confirm?next=${encodeURIComponent(next)}`
    : undefined;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo, data: { display_name: parsed.data.displayName } },
  });

  if (error) {
    // Same answer as a new account, so the form never reveals who is registered.
    if (isExistingAccountError(error)) return { status: "check-email", values };
    return { status: "error", message: authErrorMessage(error), values };
  }

  // Email confirmation off (D-014 says on, but the code supports both): already signed in.
  if (data.session && data.user) {
    try {
      await syncUserRecord(data.user);
    } catch {
      await supabase.auth.signOut({ scope: "local" });
      return { status: "error", message: AUTH_MESSAGES.unavailable, values };
    }
    redirect(next);
  }

  return { status: "check-email", values };
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  // "local" ends this browser's session only; other devices stay signed in.
  await supabase.auth.signOut({ scope: "local" });
  redirect(LOGIN_PATH);
}