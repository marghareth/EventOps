// src/app/fonts.ts
// Manrope for display text, headings and big numbers; Plus Jakarta Sans for body text, tables and
// labels (D-118, replaces Inter). Both are self-hosted by next/font at build time.
import { Manrope, Plus_Jakarta_Sans } from "next/font/google";

export const manrope = Manrope({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-manrope",
  display: "swap",
});
export const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jakarta",
  display: "swap",
});