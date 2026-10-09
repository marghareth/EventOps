// src/app/(auth)/_components/SignInForm.tsx
"use client";

import { useActionState } from "react";
import { Banner } from "@/components/shared/Banner";
import { FormErrorSummary, type FormErrorItem } from "@/components/shared/FormErrorSummary";
import { FormField, fieldControlClass } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";
import { signInAction } from "../actions";
import { initialAuthFormState, type AuthFormState } from "../form-state";

const FIELDS = { email: "sign-in-email", password: "sign-in-password" } as const;

function summary(state: AuthFormState): FormErrorItem[] {
  return (Object.keys(FIELDS) as (keyof typeof FIELDS)[]).flatMap((field) => {
    const message = state.fieldErrors?.[field];
    return message ? [{ fieldId: FIELDS[field], message }] : [];
  });
}

export function SignInForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(signInAction, initialAuthFormState);

  return (
    // noValidate: the server validates and returns accessible messages for every field.
    <form action={formAction} noValidate className="flex flex-col gap-5">
      <input type="hidden" name="next" value={next} />
      <FormErrorSummary errors={summary(state)} />
      {state.message ? (
        <Banner severity="critical" title="Couldn't sign in">
          {state.message}
        </Banner>
      ) : null}

      <FormField label="Email" id={FIELDS.email} error={state.fieldErrors?.email} required>
        {(control) => (
          <input
            {...control}
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={state.values?.email ?? ""}
            className={fieldControlClass}
          />
        )}
      </FormField>

      <FormField label="Password" id={FIELDS.password} error={state.fieldErrors?.password} required>
        {(control) => (
          <input
            {...control}
            name="password"
            type="password"
            autoComplete="current-password"
            className={fieldControlClass}
          />
        )}
      </FormField>

      <Button type="submit" disabled={pending} aria-disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}