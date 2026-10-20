// src/components/layout/Topbar.tsx
// App header: mobile menu button, event context placeholder and the user menu.
import Link from "next/link";
import { EventSwitcher } from "./EventSwitcher";
import { MobileNav } from "./MobileNav";
import { BrandMark } from "./NavIcon";
import { UserMenu, type ShellUser } from "./UserMenu";

type TopbarProps = {
  user: ShellUser;
  signOutAction: () => Promise<void>;
};

export function Topbar({ user, signOutAction }: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex min-h-16 items-center gap-2 border-b border-line bg-white/90 px-3 backdrop-blur sm:gap-3 md:px-8">
      <MobileNav />
      {/* On small screens the sidebar (and its logo) is hidden, so show the mark here. */}
      <Link href="/events" className="flex shrink-0 items-center rounded-full md:hidden">
        <BrandMark className="size-7" />
        <span className="sr-only">EventOps home</span>
      </Link>
      <div className="min-w-0 flex-1">
        <EventSwitcher />
      </div>
      <UserMenu user={user} signOutAction={signOutAction} />
    </header>
  );
}