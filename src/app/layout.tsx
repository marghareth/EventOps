// src/app/layout.tsx
import type { Metadata } from "next";
import { jakarta, manrope } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  // Pages set a short title ("Attendees"); the template adds the product name.
  title: { default: "EventOps", template: "%s · EventOps" },
  description: "The connected operations workspace for running better events.",
  // Static files live in public/ (served from the site root). B1-15.
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${manrope.variable} ${jakarta.variable}`}>
      <body>
        {/* First focusable element: lets keyboard users jump past the navigation. Every page's
            main content has id="main". */}
        <a
          href="#main"
          // not-sr-only resets padding, so the visible styles are applied under focus: too.
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-ink focus:px-5 focus:py-3 focus:font-semibold focus:text-white"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}