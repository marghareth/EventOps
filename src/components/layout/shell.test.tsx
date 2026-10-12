// src/components/layout/shell.test.tsx
// App shell components: sidebar, mobile drawer, user menu, event context placeholder.
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

let pathname = "/events";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

const { Sidebar } = await import("./Sidebar");
const { MobileNav } = await import("./MobileNav");
const { UserMenu, initialsOf } = await import("./UserMenu");
const { EventSwitcher } = await import("./EventSwitcher");
const { PagePlaceholder } = await import("./PagePlaceholder");
const { ConfirmEvent, EventContextProvider, MarkEventUnavailable } = await import("./EventContext");

const ID = "3f2c1b8e-9a4d-4c1e-8b2a-6d5f4e3c2b1a";

// jsdom does not implement the modal methods of <dialog>.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});

beforeEach(() => {
  pathname = "/events";
});

describe("Sidebar", () => {
  it("shows the global links in a labelled navigation landmark", () => {
    render(<Sidebar />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["My events", "New event"]);
  });

  it("marks the current page with aria-current, not color alone", () => {
    render(<Sidebar />);
    const current = screen.getByRole("link", { name: "My events" });
    expect(current).toHaveAttribute("aria-current", "page");
    expect(current.className).toContain("font-semibold");
    expect(screen.getByRole("link", { name: "New event" })).not.toHaveAttribute("aria-current");
  });

  it("switches to the event's sections inside an event", () => {
    pathname = `/events/${ID}/budget`;
    render(<Sidebar />);
    const nav = screen.getByRole("navigation", { name: "Event sections" });
    expect(within(nav).getByRole("link", { name: "Budget" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav).getByRole("link", { name: "Attendees" })).toHaveAttribute(
      "href",
      `/events/${ID}/attendees`,
    );
    expect(within(nav).getByRole("link", { name: "All events" })).toHaveAttribute(
      "href",
      "/events",
    );
    expect(within(nav).queryByRole("link", { name: "Check-in" })).not.toBeInTheDocument();
  });

  it("calls onNavigate when a link is chosen", async () => {
    const onNavigate = vi.fn();
    render(<Sidebar onNavigate={onNavigate} />);
    await userEvent.click(screen.getByRole("link", { name: "New event" }));
    expect(onNavigate).toHaveBeenCalledOnce();
  });
});

describe("MobileNav", () => {
  function dialog() {
    return document.querySelector("dialog") as HTMLDialogElement;
  }

  it("opens the navigation drawer from the Menu button", async () => {
    render(<MobileNav />);
    const button = screen.getByRole("button", { name: "Menu" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(dialog().open).toBe(false);

    await userEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(dialog().open).toBe(true);
    expect(dialog()).toHaveAccessibleName("Navigation");
  });

  it("closes with the close button", async () => {
    render(<MobileNav />);
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    await userEvent.click(screen.getByRole("button", { name: "Close menu", hidden: true }));
    expect(dialog().open).toBe(false);
  });

  it("closes on Escape (the dialog's cancel event)", async () => {
    render(<MobileNav />);
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    dialog().dispatchEvent(new Event("cancel", { cancelable: true }));
    await vi.waitFor(() => expect(dialog().open).toBe(false));
  });

  it("closes after choosing a link", async () => {
    render(<MobileNav />);
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    await userEvent.click(within(dialog()).getByRole("link", { name: "New event", hidden: true }));
    expect(dialog().open).toBe(false);
  });
});

describe("UserMenu", () => {
  const user = { displayName: "Mika Santos", email: "mika@example.com" };
  const signOutAction = vi.fn(async () => {});

  it("has an accessible name and starts closed", () => {
    render(<UserMenu user={user} signOutAction={signOutAction} />);
    const button = screen.getByRole("button", { name: "Account: Mika Santos" });
    expect(button).toHaveAttribute("aria-haspopup", "menu");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("opens, shows who is signed in, and focuses Sign out", async () => {
    render(<UserMenu user={user} signOutAction={signOutAction} />);
    await userEvent.click(screen.getByRole("button", { name: "Account: Mika Santos" }));
    const menu = screen.getByRole("menu", { name: "Account" });
    expect(menu).toHaveTextContent("mika@example.com");
    expect(within(menu).getByRole("menuitem", { name: "Sign out" })).toHaveFocus();
  });

  it("opens from the keyboard with ArrowDown", async () => {
    render(<UserMenu user={user} signOutAction={signOutAction} />);
    screen.getByRole("button", { name: "Account: Mika Santos" }).focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Sign out" })).toHaveFocus();
  });

  it("closes on Escape and returns focus to the button", async () => {
    render(<UserMenu user={user} signOutAction={signOutAction} />);
    const button = screen.getByRole("button", { name: "Account: Mika Santos" });
    await userEvent.click(button);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it("closes on a click outside", async () => {
    render(
      <>
        <UserMenu user={user} signOutAction={signOutAction} />
        <p>elsewhere</p>
      </>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Account: Mika Santos" }));
    await userEvent.click(screen.getByText("elsewhere"));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("signs out through the server action", async () => {
    render(<UserMenu user={user} signOutAction={signOutAction} />);
    await userEvent.click(screen.getByRole("button", { name: "Account: Mika Santos" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
    await vi.waitFor(() => expect(signOutAction).toHaveBeenCalled());
  });

  it.each([
    ["Mika Santos", "MS"],
    ["mika", "M"],
    ["  Ana  Maria  Reyes ", "AR"],
    ["", "?"],
  ])("initials of %j are %s", (name, initials) => {
    expect(initialsOf(name)).toBe(initials);
  });
});

describe("EventSwitcher", () => {
  it("shows nothing outside an event", () => {
    const { container } = render(<EventSwitcher />);
    expect(container).toBeEmptyDOMElement();
  });

  it("offers a way back to the event list, and never shows the raw event ID", () => {
    pathname = `/events/${ID}/attendees`;
    render(<EventSwitcher />);
    expect(screen.queryByText(ID)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Switch event" })).toHaveAttribute("href", "/events");
  });
});

describe("PagePlaceholder", () => {
  it("names the page and says it is not built yet", () => {
    render(<PagePlaceholder title="Budget" />);
    expect(screen.getByRole("heading", { level: 1, name: "Budget" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Not built yet" })).toBeInTheDocument();
  });

  it("explains Tier 2 pages", () => {
    render(<PagePlaceholder title="Check-in" tier={2} />);
    expect(screen.getByText(/Tier 2 feature/)).toBeInTheDocument();
  });
});

describe("event context in the shell (B1-13)", () => {
  const confirmed = { id: ID, name: "Santos wedding", reference: "EVT-2026-0001" };

  it("shows the event's sections inside an event", () => {
    pathname = `/events/${ID}/budget`;
    render(
      <EventContextProvider>
        <Sidebar />
      </EventContextProvider>,
    );
    expect(screen.getByRole("navigation", { name: "Event sections" })).toBeInTheDocument();
  });

  it("falls back to the global links when the event is unavailable", () => {
    pathname = `/events/${ID}/budget`;
    render(
      <EventContextProvider>
        <MarkEventUnavailable />
        <Sidebar />
      </EventContextProvider>,
    );
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Budget/ })).not.toBeInTheDocument();
    expect(screen.queryByText("All events")).not.toBeInTheDocument();
  });

  it("names the event in the top bar only once access is confirmed", () => {
    pathname = `/events/${ID}/settings`;
    const { rerender } = render(
      <EventContextProvider>
        <EventSwitcher />
      </EventContextProvider>,
    );
    expect(screen.queryByText("Santos wedding")).not.toBeInTheDocument();
    rerender(
      <EventContextProvider>
        <ConfirmEvent event={confirmed} />
        <EventSwitcher />
      </EventContextProvider>,
    );
    expect(screen.getByText("Santos wedding")).toBeInTheDocument();
    expect(screen.getByText(/Current event:/)).toHaveClass("sr-only");
  });

  it("never shows a confirmed event's name for a different event in the URL", () => {
    pathname = "/events/7a1e2b3c-4d5e-4f60-8a9b-0c1d2e3f4a5b";
    render(
      <EventContextProvider>
        <ConfirmEvent event={confirmed} />
        <EventSwitcher />
      </EventContextProvider>,
    );
    expect(screen.queryByText("Santos wedding")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Switch event" })).toBeInTheDocument();
  });

  it("forgets the event when its layout unmounts", () => {
    pathname = `/events/${ID}`;
    const { rerender } = render(
      <EventContextProvider>
        <ConfirmEvent event={confirmed} />
        <EventSwitcher />
      </EventContextProvider>,
    );
    expect(screen.getByText("Santos wedding")).toBeInTheDocument();
    rerender(
      <EventContextProvider>
        <EventSwitcher />
      </EventContextProvider>,
    );
    expect(screen.queryByText("Santos wedding")).not.toBeInTheDocument();
  });
});