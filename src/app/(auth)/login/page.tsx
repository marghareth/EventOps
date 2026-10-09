// src/app/(auth)/login/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Banner } from "@/components/shared/Banner";
import { SIGN_UP_PATH, loginPageError, safeNextPath } from "@/lib/auth-rules";
import { SignInForm } from "../_components/SignInForm";

export const metadata: Metadata = { title: "Sign in · EventOps" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const next = safeNextPath(first(params.next));
  // Only known error keys map to a message; the raw query value is never shown.
  const error = loginPageError(first(params.error));
  const signUpHref = `${SIGN_UP_PATH}?next=${encodeURIComponent(next)}`;

  return (
    <>
      <h1 className="text-h2 font-extrabold">Sign in</h1>
      <p className="mt-2 mb-6 text-ink-2">Welcome back. Sign in to manage your events.</p>
      {error ? (
        <Banner severity="critical" title="Couldn't sign you in" className="mb-5">
          {error}
        </Banner>
      ) : null}
      <SignInForm next={next} />
      <p className="mt-6 text-sm text-ink-2">
        New to EventOps?{" "}
        <Link href={signUpHref} className="font-semibold text-blue underline underline-offset-2">
          Create an account
        </Link>
      </p>
    </>
  );
}