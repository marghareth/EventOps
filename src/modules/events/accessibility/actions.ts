// src/modules/events/accessibility/actions.ts
// Accessibility server actions (B3-03 requirements, B3-05 event resources). Server actions are public HTTP endpoints, so each one
// authorizes first with authorizeEvent(eventId, "accessibility.manage") (D-035, D-036) and
// validates every input on the server with the shared schemas (D-057). IDs come from the bound
// arguments and are checked here; the repository re-checks the role and the event in storage.
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fieldErrorsFrom } from "@/lib/auth-rules";
import { authorizeEvent } from "@/modules/events/public";
import { addRequirement } from "./application/add-requirement";
import { removeRequirement } from "./application/remove-requirement";
import { removeResource } from "./application/remove-resource";
import { saveResource } from "./application/save-resource";
import { updateRequirement } from "./application/update-requirement";
import { accessibilityRepository } from "./composition";
import {
  ACCESSIBILITY_MESSAGES as MESSAGES,
  type RemoveFormState,
  type RequirementFormState,
  type ResourceFormState,
} from "./form-state";
import {
  REQUIREMENT_FIELDS,
  RESOURCE_FIELDS,
  requirementFormSchema,
  resourceFormSchema,
  resourceTypeSchema,
  type RequirementField,
  type ResourceField,
} from "./schema";

const idSchema = z.uuid();
const versionSchema = z.iso.datetime();

const REFUSED = { "not-found": MESSAGES.eventNotFound, forbidden: MESSAGES.forbidden } as const;

const attendeePath = (eventId: string, attendeeId: string) =>
  `/events/${encodeURIComponent(eventId)}/attendees/${encodeURIComponent(attendeeId)}`;

function requirementValues(formData: FormData): Record<RequirementField, string> {
  const values = {} as Record<RequirementField, string>;
  for (const field of REQUIREMENT_FIELDS) {
    const value = formData.get(field);
    values[field] = typeof value === "string" ? value : "";
  }
  return values;
}

/** Back to the attendee's details page with a notice. Only these words ever reach the address. */
function backToAttendee(
  eventId: string,
  attendeeId: string,
  notice: "added" | "saved" | "removed",
  type: string,
): never {
  const path = attendeePath(eventId, attendeeId);
  revalidatePath(path);
  redirect(`${path}?accessibility=${notice}&need=${encodeURIComponent(type)}`);
}

/**
 * Adds an accessibility requirement to an attendee, then opens the attendee's details page with an
 * "added" notice (B3-03). Owners and Coordinators (accessibility.manage).
 */
export async function createRequirementAction(
  eventId: string,
  attendeeId: string,
  _previous: RequirementFormState,
  formData: FormData,
): Promise<RequirementFormState> {
  const auth = await authorizeEvent(
    eventId,
    "accessibility.manage",
    attendeePath(eventId, attendeeId),
  );
  const values = requirementValues(formData);
  if (!auth.ok) return { status: "error", message: REFUSED[auth.reason], values };
  if (!idSchema.safeParse(attendeeId).success) {
    return { status: "error", message: MESSAGES.attendeeNotFound, values };
  }
  const parsed = requirementFormSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  }

  let result: Awaited<ReturnType<typeof addRequirement>>;
  try {
    result = await addRequirement(accessibilityRepository(), {
      eventId: auth.event.id,
      attendeeId,
      actorId: auth.user.id,
      input: parsed.data,
    });
  } catch {
    // Database unreachable or a constraint failed: nothing was saved (one transaction).
    return { status: "error", message: MESSAGES.saveFailed, values };
  }
  if (!result.ok) {
    if (result.reason === "duplicate") {
      return { status: "error", fieldErrors: { type: MESSAGES.duplicate }, values };
    }
    // Another event's attendee, a removed attendee, or the role changed after the check above.
    return { status: "error", message: MESSAGES.attendeeNotFound, values };
  }
  // redirect() works by throwing, so it stays outside the try block.
  backToAttendee(auth.event.id, attendeeId, "added", parsed.data.type);
}

/**
 * Saves an accessibility requirement, unless someone else saved it first (D-032), then opens the
 * attendee's details page with a "saved" notice. Nothing changed: says so and records nothing.
 */
export async function updateRequirementAction(
  eventId: string,
  attendeeId: string,
  requirementId: string,
  _previous: RequirementFormState,
  formData: FormData,
): Promise<RequirementFormState> {
  const auth = await authorizeEvent(
    eventId,
    "accessibility.manage",
    attendeePath(eventId, attendeeId),
  );
  const values = requirementValues(formData);
  if (!auth.ok) return { status: "error", message: REFUSED[auth.reason], values };
  if (!idSchema.safeParse(attendeeId).success || !idSchema.safeParse(requirementId).success) {
    return { status: "error", message: MESSAGES.requirementNotFound, values };
  }
  const parsed = requirementFormSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  }
  const version = versionSchema.safeParse(formData.get("version"));
  if (!version.success) return { status: "error", message: MESSAGES.requirementStale, values };

  let result: Awaited<ReturnType<typeof updateRequirement>>;
  try {
    result = await updateRequirement(accessibilityRepository(), {
      eventId: auth.event.id,
      attendeeId,
      requirementId,
      actorId: auth.user.id,
      version: new Date(version.data),
      input: parsed.data,
    });
  } catch {
    return { status: "error", message: MESSAGES.saveFailed, values };
  }
  if (!result.ok) {
    if (result.reason === "duplicate") {
      return { status: "error", fieldErrors: { type: MESSAGES.duplicate }, values };
    }
    const message =
      result.reason === "stale" ? MESSAGES.requirementStale : MESSAGES.requirementNotFound;
    return { status: "error", message, values };
  }
  if ("unchanged" in result) return { status: "success", message: MESSAGES.unchanged };
  backToAttendee(auth.event.id, attendeeId, "saved", parsed.data.type);
}

/**
 * Permanently removes an accessibility requirement, then opens the attendee's details page with a
 * "removed" notice. Works with useActionState: the state and form data after the bound IDs are not
 * needed.
 */
export async function deleteRequirementAction(
  eventId: string,
  attendeeId: string,
  requirementId: string,
): Promise<RemoveFormState> {
  const auth = await authorizeEvent(
    eventId,
    "accessibility.manage",
    attendeePath(eventId, attendeeId),
  );
  if (!auth.ok) return { status: "error", message: REFUSED[auth.reason] };
  if (!idSchema.safeParse(attendeeId).success || !idSchema.safeParse(requirementId).success) {
    return { status: "error", message: MESSAGES.requirementNotFound };
  }

  let result: Awaited<ReturnType<typeof removeRequirement>>;
  try {
    result = await removeRequirement(accessibilityRepository(), {
      eventId: auth.event.id,
      attendeeId,
      requirementId,
      actorId: auth.user.id,
    });
  } catch {
    return { status: "error", message: MESSAGES.deleteFailed };
  }
  // Already removed, another attendee's or event's requirement, or the role changed meanwhile.
  if (!result.ok) return { status: "error", message: MESSAGES.requirementNotFound };
  backToAttendee(auth.event.id, attendeeId, "removed", result.type);
}

// ───────────────────────── Event resources (B3-05, D-061) ─────────────────────────

const accessibilityPath = (eventId: string) =>
  `/events/${encodeURIComponent(eventId)}/accessibility`;

function resourceValues(formData: FormData): Record<ResourceField, string> {
  const values = {} as Record<ResourceField, string>;
  for (const field of RESOURCE_FIELDS) {
    const value = formData.get(field);
    values[field] = typeof value === "string" ? value : "";
  }
  return values;
}

/** Back to the Accessibility page with a notice. Only these words ever reach the address. */
function backToResources(eventId: string, notice: "saved" | "removed", type: string): never {
  const path = accessibilityPath(eventId);
  revalidatePath(path);
  redirect(`${path}?resource=${notice}&type=${encodeURIComponent(type)}`);
}

/**
 * Sets up or edits one of the event's accessibility resources, then opens the Accessibility page
 * with a "saved" notice. The type is bound by the page, never read from the form. A form opened
 * while the type was "Not set up" sends no version and creates it; otherwise stale saves are
 * refused (D-032) and a save that changes nothing records nothing.
 */
export async function saveResourceAction(
  eventId: string,
  type: string,
  _previous: ResourceFormState,
  formData: FormData,
): Promise<ResourceFormState> {
  const auth = await authorizeEvent(eventId, "accessibility.manage", accessibilityPath(eventId));
  const values = resourceValues(formData);
  if (!auth.ok) return { status: "error", message: REFUSED[auth.reason], values };
  const resourceType = resourceTypeSchema.safeParse(type);
  if (!resourceType.success) {
    return { status: "error", message: MESSAGES.resourceNotFound, values };
  }
  const parsed = resourceFormSchema(resourceType.data).safeParse(values);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  }
  const rawVersion = formData.get("version");
  let version: Date | null = null;
  if (rawVersion !== null && rawVersion !== "") {
    const checked = versionSchema.safeParse(rawVersion);
    if (!checked.success) return { status: "error", message: MESSAGES.resourceStale, values };
    version = new Date(checked.data);
  }

  let result: Awaited<ReturnType<typeof saveResource>>;
  try {
    result = await saveResource(accessibilityRepository(), {
      eventId: auth.event.id,
      type: resourceType.data,
      actorId: auth.user.id,
      version,
      input: parsed.data,
    });
  } catch {
    return { status: "error", message: MESSAGES.saveFailed, values };
  }
  if (!result.ok) {
    const message = {
      exists: MESSAGES.resourceExists,
      stale: MESSAGES.resourceStale,
      "not-found": version === null ? MESSAGES.forbidden : MESSAGES.resourceNotFound,
    }[result.reason];
    return { status: "error", message, values };
  }
  if ("unchanged" in result) return { status: "success", message: MESSAGES.unchanged };
  backToResources(auth.event.id, "saved", resourceType.data);
}

/**
 * Removes one of the event's accessibility resources, so it shows as "Not set up" again, then
 * opens the Accessibility page with a "removed" notice.
 */
export async function deleteResourceAction(
  eventId: string,
  type: string,
): Promise<RemoveFormState> {
  const auth = await authorizeEvent(eventId, "accessibility.manage", accessibilityPath(eventId));
  if (!auth.ok) return { status: "error", message: REFUSED[auth.reason] };
  const resourceType = resourceTypeSchema.safeParse(type);
  if (!resourceType.success) return { status: "error", message: MESSAGES.resourceNotFound };

  let result: Awaited<ReturnType<typeof removeResource>>;
  try {
    result = await removeResource(accessibilityRepository(), {
      eventId: auth.event.id,
      type: resourceType.data,
      actorId: auth.user.id,
    });
  } catch {
    return { status: "error", message: MESSAGES.deleteFailed };
  }
  if (!result.ok) return { status: "error", message: MESSAGES.resourceNotFound };
  backToResources(auth.event.id, "removed", resourceType.data);
}