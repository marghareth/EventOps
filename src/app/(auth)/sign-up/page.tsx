// src/app/(auth)/sign-up/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { LOGIN_PATH, safeNextPath } from "@/lib/auth-rules";
import { SignUpForm } from "../_components/SignUpForm";

export const metadata: Metadata = { title: "Create account · EventOps" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SignUpPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const raw = Array.isArray(params.next) ? params.next[0] : params.next;
  const next = safeNextPath(raw);

  return (
    <>
      <h1 className="text-h2 font-extrabold">Create your account</h1>
      <p className="mt-2 mb-6 text-ink-2">Bring your event spreadsheet into one live workspace.</p>
      <SignUpForm next={next} />
      <p className="mt-6 text-sm text-ink-2">
        Already have an account?{" "}
        <Link
          href={`${LOGIN_PATH}?next=${encodeURIComponent(next)}`}
          className="font-semibold text-blue underline underline-offset-2"
        >
          Sign in
        </Link>
      </p>
    </>
  );
}