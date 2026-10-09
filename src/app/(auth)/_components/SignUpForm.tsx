// src/app/(auth)/_components/SignUpForm.tsx
"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Banner } from "@/components/shared/Banner";
import { FormErrorSummary, type FormErrorItem } from "@/components/shared/FormErrorSummary";
import { FormField, fieldControlClass } from "@/components/shared/FormField";
import { SuccessMessage } from "@/components/shared/SuccessMessage";
import { Button } from "@/components/ui/button";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth-rules";
import { signUpAction } from "../actions";
import { initialAuthFormState, type AuthFormState } from "../form-state";

const FIELDS = {
  displayName: "sign-up-name",
  email: "sign-up-email",
  password: "sign-up-password",
} as const;

function summary(state: AuthFormState): FormErrorItem[] {
  return (Object.keys(FIELDS) as (keyof typeof FIELDS)[]).flatMap((field) => {
    const message = state.fieldErrors?.[field];
    return message ? [{ fieldId: FIELDS[field], message }] : [];
  });
}

export function SignUpForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(signUpAction, initialAuthFormState);

  if (state.status === "check-email") {
    return (
      <SuccessMessage
        title="Check your email"
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/login">Go to sign in</Link>
          </Button>
        }
      >
        If {state.values?.email || "that address"} can be used for EventOps, we sent it a link. Open
        it to finish creating your account.
      </SuccessMessage>
    );
  }

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      <input type="hidden" name="next" value={next} />
      <FormErrorSummary errors={summary(state)} />
      {state.message ? (
        <Banner severity="critical" title="Couldn't create your account">
          {state.message}
        </Banner>
      ) : null}

      <FormField
        label="Name"
        id={FIELDS.displayName}
        error={state.fieldErrors?.displayName}
        required
      >
        {(control) => (
          <input
            {...control}
            name="displayName"
            type="text"
            autoComplete="name"
            defaultValue={state.values?.displayName ?? ""}
            className={fieldControlClass}
          />
        )}
      </FormField>

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

      <FormField
        label="Password"
        id={FIELDS.password}
        hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
        error={state.fieldErrors?.password}
        required
      >
        {(control) => (
          <input
            {...control}
            name="password"
            type="password"
            autoComplete="new-password"
            className={fieldControlClass}
          />
        )}
      </FormField>

      <Button type="submit" disabled={pending} aria-disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}