// src/modules/events/accessibility/form-state.ts
// State shared by the accessibility forms and their server actions (B3-03, B3-05). Separate from
// actions.ts because a "use server" file may only export async functions.
import type { RequirementField, ResourceField } from "./schema";

type FormState<Field extends string> = {
  status: "idle" | "error" | "success";
  /** Form-level message, already safe to show. */
  message?: string;
  fieldErrors?: Partial<Record<Field, string>>;
  /** What the user typed, so a failed submit keeps it. */
  values?: Partial<Record<Field, string>>;
};

export type RequirementFormState = FormState<RequirementField>;
export type ResourceFormState = FormState<ResourceField>;

export const initialRequirementFormState: RequirementFormState = { status: "idle" };
export const initialResourceFormState: ResourceFormState = { status: "idle" };

/** Removing a requirement or a resource. Success redirects, so only errors come back. */
export type RemoveFormState = { status: "idle" | "error"; message?: string };

export const initialRemoveState: RemoveFormState = { status: "idle" };

/** Messages for accessibility actions. Never include internal error details. */
export const ACCESSIBILITY_MESSAGES = {
  unchanged: "No changes to save.",
  forbidden:
    "Your role can view accessibility information but not change it. Ask an Owner or Coordinator.",
  eventNotFound: "This event isn't available. Go back to your events and open it again.",
  attendeeNotFound: "This attendee isn't available. They may have been removed.",
  requirementNotFound: "This accessibility need isn't available. It may have been removed.",
  duplicate: "This guest already has this need. Edit the existing one instead.",
  requirementStale:
    "This accessibility need changed since you opened it. Reload to see the latest, then make your change again.",
  saveFailed: "We couldn't save the change. Nothing was saved. Try again in a moment.",
  deleteFailed: "We couldn't remove it. Nothing was removed. Try again in a moment.",
  resourceStale:
    "This resource changed since you opened it. Reload to see the latest, then make your change again.",
  resourceNotFound: "This resource isn't set up any more. It may have been removed.",
  resourceExists: "This resource was set up meanwhile. Reload to see it, then make your change.",
} as const;