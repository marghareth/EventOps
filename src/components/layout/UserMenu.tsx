// src/components/layout/UserMenu.tsx
// Account menu in the header: who is signed in, and Sign out. Follows the design system's dropdown
// pattern. Keyboard: Enter/Space/ArrowDown opens and focuses the first item, Escape closes and
// returns focus to the button, Tab or a click outside closes it.
"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { NavIcon } from "./NavIcon";

export type ShellUser = { displayName: string; email: string };

type UserMenuProps = {
  user: ShellUser;
  /** Server action that signs out. The menu is only the trigger; the action does the work. */
  signOutAction: () => Promise<void>;
};

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0][0], parts[parts.length - 1][0]] : [parts[0]?.[0]];
  return letters.filter(Boolean).join("").toUpperCase() || "?";
}

export function UserMenu({ user, signOutAction }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const closeAndFocusButton = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  // Focus the first item when the menu opens.
  useEffect(() => {
    if (open) menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);

  // Close on a click outside.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const onButtonKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
    }
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeAndFocusButton();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Account: ${user.displayName}`}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={onButtonKeyDown}
        className="flex min-h-11 items-center gap-2 rounded-full py-1 pr-2 pl-1 hover:bg-ink/10"
      >
        <span
          aria-hidden="true"
          className="flex size-9 items-center justify-center rounded-full bg-blue-tint font-display text-sm font-bold text-blue"
        >
          {initialsOf(user.displayName)}
        </span>
        <span
          aria-hidden="true"
          className="hidden max-w-40 truncate text-sm font-semibold sm:inline"
        >
          {user.displayName}
        </span>
        <NavIcon name="chevron-down" className="size-4 text-ink-3" />
      </button>

      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Account"
          onKeyDown={onMenuKeyDown}
          className="absolute top-[calc(100%+8px)] right-0 z-40 w-64 rounded-lg border border-line bg-white p-1.5 shadow-lg"
        >
          <div role="none" className="px-3 py-2">
            <p className="truncate font-semibold">{user.displayName}</p>
            <p className="truncate text-sm text-ink-3">{user.email}</p>
          </div>
          <div role="separator" className="my-1.5 h-px bg-line" />
          <form action={signOutAction} role="none">
            <button
              type="submit"
              role="menuitem"
              className="flex min-h-11 w-full items-center gap-2.5 rounded-md px-3 text-left text-sm hover:bg-paper focus-visible:bg-paper"
            >
              <NavIcon name="logout" className="size-4" />
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}