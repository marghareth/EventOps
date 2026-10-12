// src/components/layout/EventContext.tsx
// Which event the shell is showing (B1-13, D-038). The URL names the event, but the shell (sidebar,
// top bar) renders before the event loads, so it can't tell by itself whether access was granted.
// The event layout confirms the event here only after the server-side access check passed; the
// in-shell not-found page marks the event as unavailable. Display only: this is never an access
// check, and it holds nothing the user could not already see on the page.
"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ConfirmedEvent = { id: string; name: string; reference: string };

type EventContextValue = {
  confirmed: ConfirmedEvent | null;
  unavailable: boolean;
  setConfirmed: (event: ConfirmedEvent | null) => void;
  setUnavailable: (value: boolean) => void;
};

const EventContext = createContext<EventContextValue>({
  confirmed: null,
  unavailable: false,
  setConfirmed: () => {},
  setUnavailable: () => {},
});

export function EventContextProvider({ children }: { children: ReactNode }) {
  const [confirmed, setConfirmed] = useState<ConfirmedEvent | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  return (
    <EventContext.Provider value={{ confirmed, unavailable, setConfirmed, setUnavailable }}>
      {children}
    </EventContext.Provider>
  );
}

/** Rendered by the event layout after the access check passed. Renders nothing. */
export function ConfirmEvent({ event }: { event: ConfirmedEvent }) {
  const { setConfirmed } = useContext(EventContext);
  const { id, name, reference } = event;
  useEffect(() => {
    setConfirmed({ id, name, reference });
    return () => setConfirmed(null);
  }, [setConfirmed, id, name, reference]);
  return null;
}

/** Rendered by the in-shell not-found page: the event in the URL is not available. */
export function MarkEventUnavailable() {
  const { setUnavailable } = useContext(EventContext);
  useEffect(() => {
    setUnavailable(true);
    return () => setUnavailable(false);
  }, [setUnavailable]);
  return null;
}

/** The confirmed event, only if it is the one in the URL (never a stale one mid-navigation). */
export function useConfirmedEvent(eventIdInPath: string | null): ConfirmedEvent | null {
  const { confirmed } = useContext(EventContext);
  return confirmed && confirmed.id === eventIdInPath ? confirmed : null;
}

export function useEventUnavailable(): boolean {
  return useContext(EventContext).unavailable;
}