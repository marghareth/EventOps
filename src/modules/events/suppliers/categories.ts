// src/modules/events/suppliers/categories.ts
// The canonical supplier categories (B4-02, D-069). The form, server validation, the supplier list,
// the audit registry's copy and the database enum all follow this list; tests keep them equal.
// "Other" needs a short description of what the supplier provides, so nothing is lost when a
// supplier fits no category. Adding a category is one line here plus a migration that adds the enum
// value. Pure: no database, no clock, safe for client components.

/** What a supplier provides. Order is the order shown in forms and filters. */
export const SUPPLIER_CATEGORIES = [
  "VENUE",
  "CATERING",
  "CAKE_AND_DESSERTS",
  "PHOTO_AND_VIDEO",
  "SOUND_AND_LIGHTS",
  "ENTERTAINMENT",
  "FLOWERS_AND_STYLING",
  "HAIR_AND_MAKEUP",
  "ATTIRE",
  "RENTALS",
  "TRANSPORT",
  "PRINTING_AND_STATIONERY",
  "OTHER",
] as const;
export type SupplierCategory = (typeof SUPPLIER_CATEGORIES)[number];

type SupplierCategoryDefinition = {
  /** Short name for lists, badges and the Activity feed. */
  label: string;
  /** What the category covers, shown as a hint in the form. */
  description: string;
};

export const SUPPLIER_CATEGORY_DEFINITIONS: Record<SupplierCategory, SupplierCategoryDefinition> = {
  VENUE: { label: "Venue", description: "Where the event takes place." },
  CATERING: { label: "Catering", description: "Food and drinks for guests." },
  CAKE_AND_DESSERTS: {
    label: "Cake and desserts",
    description: "Cakes, pastries, dessert tables.",
  },
  PHOTO_AND_VIDEO: { label: "Photo and video", description: "Photographers and videographers." },
  SOUND_AND_LIGHTS: {
    label: "Sound and lights",
    description: "Sound systems, lighting and technical crew.",
  },
  ENTERTAINMENT: {
    label: "Entertainment",
    description: "Bands, DJs, hosts and performers.",
  },
  FLOWERS_AND_STYLING: {
    label: "Flowers and styling",
    description: "Florists, stylists and decorations.",
  },
  HAIR_AND_MAKEUP: { label: "Hair and makeup", description: "Hair and makeup artists." },
  ATTIRE: { label: "Attire", description: "Gowns, suits and costume rentals." },
  RENTALS: {
    label: "Rentals",
    description: "Tables, chairs, tents, linens and other equipment.",
  },
  TRANSPORT: { label: "Transport", description: "Cars, vans and shuttles." },
  PRINTING_AND_STATIONERY: {
    label: "Printing and stationery",
    description: "Invitations, signage, programs and other print.",
  },
  OTHER: {
    label: "Other",
    description: "Anything else. Say what the supplier provides.",
  },
};

export function isSupplierCategory(value: unknown): value is SupplierCategory {
  return typeof value === "string" && (SUPPLIER_CATEGORIES as readonly string[]).includes(value);
}

/**
 * How a supplier's category reads in lists and the Activity feed: the label, or for Other what the
 * supplier provides ("Other: Fireworks").
 */
export function supplierCategoryText(category: SupplierCategory, detail: string | null): string {
  const label = SUPPLIER_CATEGORY_DEFINITIONS[category].label;
  return category === "OTHER" && detail ? `${label}: ${detail}` : label;
}