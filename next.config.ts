// next.config.ts
import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { assertDemoAuthNotInBuild } from "./src/lib/demo-auth";

export default function nextConfig(phase: string): NextConfig {
  // Dev-only demo sign-in must never be built into a deployment (D-024).
  if (phase === PHASE_PRODUCTION_BUILD) assertDemoAuthNotInBuild();
  return {};
}