// src/components/layout/MobileNav.tsx
// Below the md breakpoint the sidebar lives in a drawer opened by a "Menu" button. Built on the
// native <dialog> (like ConfirmDialog): focus is trapped, the page behind is inert, Escape closes
// it, and focus returns to the Menu button.
"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { BrandMark, NavIcon } from "./NavIcon";
import { Sidebar } from "./Sidebar";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dialogId = useId();
  const close = () => setOpen(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls={dialogId}
        className="flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold text-ink hover:bg-ink/10 md:hidden"
      >
        <NavIcon name="menu" />
        Menu
      </button>
      <dialog
        ref={dialogRef}
        id={dialogId}
        aria-label="Navigation"
        // Escape fires "cancel"; keep the dialog controlled by state.
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        // A click on the backdrop targets the dialog element itself.
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        className="fixed inset-y-0 left-0 m-0 h-dvh max-h-dvh w-72 max-w-[85vw] bg-white p-0 text-ink shadow-lg backdrop:bg-ink/55 md:hidden"
      >
        <div className="flex h-full flex-col">
          <div className="flex min-h-16 items-center justify-between gap-2 border-b border-line px-4">
            <Link
              href="/events"
              onClick={close}
              className="flex items-center gap-2 font-display text-h4 font-extrabold"
            >
              <BrandMark className="size-7" />
              EventOps
            </Link>
            <button
              type="button"
              onClick={close}
              aria-label="Close menu"
              className="flex size-11 items-center justify-center rounded-full hover:bg-ink/10"
            >
              <NavIcon name="close" />
            </button>
          </div>
          <Sidebar onNavigate={close} className="flex-1 overflow-y-auto" />
        </div>
      </dialog>
    </>
  );
}