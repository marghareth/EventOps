// src/app/layout.tsx
import type { Metadata } from "next";
import { inter, manrope } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "EventOps",
  description: "The connected operations workspace for running better events.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${manrope.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}