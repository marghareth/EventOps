// src/lib/demo-auth.ts
// Dev-only demo sign-in (D-024): view signed-in pages on localhost without a Supabase project.
//
// On only when BOTH are true:
//   - DEV_DEMO_AUTH=true (in .env.local), and
//   - NODE_ENV is "development", which only `next dev` sets.
// `next build` refuses to run with DEV_DEMO_AUTH=true (next.config.ts), and `next start`,
// Vercel and tests never run with NODE_ENV=development, so this can never reach production.
// When on, every request is treated as the demo user below. Nothing is checked against Supabase.

/** Fixed demo identity. Never a real Supabase user. */
export const DEMO_USER = {
  id: "00000000-0000-4000-8000-00000000d3e0",
  email: "demo@eventops.local",
  displayName: "Demo Coordinator",
} as const;

type Env = Record<string, string | undefined>;

export function isDemoAuthEnabled(env: Env = process.env): boolean {
  return env.DEV_DEMO_AUTH === "true" && env.NODE_ENV === "development";
}

/**
 * Demo sign-in with no DATABASE_URL: event data comes from the in-memory sample store
 * (src/modules/events/sample-data.ts, D-041) instead of PostgreSQL. Setting DATABASE_URL switches
 * it off, so the same demo user then works against a real database.
 */
export function isSampleDataMode(env: Env = process.env): boolean {
  return isDemoAuthEnabled(env) && !env.DATABASE_URL;
}

/**
 * Throws when a production build is attempted with the demo flag set. Called from next.config.ts
 * so a misconfigured deployment fails loudly instead of shipping with the flag in its env.
 */
export function assertDemoAuthNotInBuild(env: Env = process.env): void {
  if (env.DEV_DEMO_AUTH === "true") {
    throw new Error(
      "DEV_DEMO_AUTH=true is set. Demo sign-in is for `npm run dev` only; remove it before building.",
    );
  }
}