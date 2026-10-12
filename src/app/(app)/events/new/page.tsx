// src/app/(app)/events/new/page.tsx
// Create Event (B1-02). The (app) layout already requires sign-in; the server action checks again.
import type { Metadata } from "next";
import { CreateEventForm, createEventAction } from "@/modules/events/public";

export const metadata: Metadata = { title: "New event" };

export default function NewEventPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-h2 font-extrabold">Create an event</h1>
      <p className="mt-2 text-ink-2">
        Start with the essentials. You become the event&apos;s Owner and can add details later.
      </p>
      <div className="mt-6 rounded-xl bg-white p-6 shadow-xs sm:p-8">
        <CreateEventForm action={createEventAction} />
      </div>
    </div>
  );
}