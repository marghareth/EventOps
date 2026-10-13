// src/modules/events/attendees/guest-list-query.test.ts
// Guest list search, filters and sorting (B2-10, B2-11, B2-12; D-050): reading the address,
// matching, combining filters with AND, sorting with stable tie-breaks, and never changing input.
import { describe, expect, it } from "vitest";
import {
  DEFAULT_QUERY,
  applyGuestListQuery,
  categoriesOf,
  describeCriteria,
  filterGuestList,
  fold,
  guestListQueryString,
  hasCriteriaBeyondRsvp,
  isNarrowed,
  matchesSearch,
  parseGuestListQuery,
  sortGuestList,
  type GuestListQuery,
  type QueryableRow,
} from "./guest-list-query";

const row = (fields: Partial<QueryableRow> & { name: string; number: number }): QueryableRow => ({
  rsvpStatus: "PENDING",
  plusOnes: 0,
  category: null,
  ...fields,
});

const ana = row({
  number: 1,
  name: "Ana Reyes",
  rsvpStatus: "CONFIRMED",
  plusOnes: 1,
  category: "Family",
  dietaryNeeds: "Vegetarian",
});
const ben = row({ number: 2, name: "Ben Lim", category: "Friends", dietaryNeeds: null });
const pena = row({
  number: 8,
  name: "José Peña",
  rsvpStatus: "MAYBE",
  plusOnes: 3,
  category: "family",
  dietaryNeeds: "  ",
});
const ana2 = row({ number: 18, name: "ana reyes", rsvpStatus: "DECLINED", category: null });
const all = [ana, ben, pena, ana2];
const names = (rows: readonly QueryableRow[]) => rows.map((r) => `${r.name}#${r.number}`);
const q = (fields: Partial<GuestListQuery>): GuestListQuery => ({ ...DEFAULT_QUERY, ...fields });

describe("fold", () => {
  it("ignores case, accents and extra spaces", () => {
    expect(fold("  José   PEÑA ")).toBe("jose pena");
  });
});

describe("categoriesOf", () => {
  it("lists each category once, ignoring case, sorted, without blanks", () => {
    expect(categoriesOf(all)).toEqual(["Family", "Friends"]);
    expect(categoriesOf([])).toEqual([]);
  });
});

describe("parseGuestListQuery", () => {
  const context = { categories: ["Family", "Friends"], dietaryVisible: true };

  it("defaults to everyone, by name, ascending", () => {
    expect(parseGuestListQuery({}, context)).toEqual(DEFAULT_QUERY);
  });

  it("reads every value it knows", () => {
    expect(
      parseGuestListQuery(
        {
          q: "  ana ",
          rsvp: "confirmed",
          category: "family",
          dietary: "yes",
          plusones: "no",
          sort: "rsvp",
          dir: "desc",
        },
        context,
      ),
    ).toEqual({
      search: "ana",
      rsvp: "CONFIRMED",
      category: "Family",
      dietary: "yes",
      plusOnes: "no",
      sort: "rsvp",
      dir: "desc",
    });
  });

  it("ignores unknown values instead of failing", () => {
    expect(
      parseGuestListQuery(
        {
          q: "   ",
          rsvp: "ATTENDING",
          category: "VIP",
          dietary: "maybe",
          plusones: "1",
          sort: "email",
          dir: "up",
        },
        context,
      ),
    ).toEqual(DEFAULT_QUERY);
  });

  it("ignores the dietary filter for a role that can't see dietary needs", () => {
    expect(
      parseGuestListQuery({ dietary: "yes" }, { ...context, dietaryVisible: false }).dietary,
    ).toBeNull();
  });

  it("cuts a long search to 100 characters and uses the first of repeated values", () => {
    expect(parseGuestListQuery({ q: "a".repeat(150) }, context).search).toHaveLength(100);
    expect(parseGuestListQuery({ sort: ["id", "name"] }, context).sort).toBe("id");
  });
});

describe("guestListQueryString", () => {
  it("writes only what differs from the default, and reads back the same", () => {
    expect(guestListQueryString(DEFAULT_QUERY)).toBe("");
    const query = q({
      search: "José & co",
      rsvp: "MAYBE",
      category: "Family",
      plusOnes: "yes",
      sort: "id",
      dir: "desc",
    });
    const text = guestListQueryString(query);
    expect(text).toBe(
      "?q=Jos%C3%A9+%26+co&rsvp=maybe&category=Family&plusones=yes&sort=id&dir=desc",
    );
    const params = Object.fromEntries(new URLSearchParams(text));
    expect(parseGuestListQuery(params, { categories: ["Family"], dietaryVisible: true })).toEqual(
      query,
    );
  });
});

describe("matchesSearch (B2-10)", () => {
  it.each([
    ["ana", true],
    ["REYES", true],
    ["a r", true],
    ["pena", false],
    ["anar", false],
    ["zzz", false],
  ])("name: %j → %s for Ana Reyes", (text, expected) => {
    expect(matchesSearch(ana, text)).toBe(expected);
  });

  it("matches accents both ways", () => {
    expect(matchesSearch(pena, "pena")).toBe(true);
    expect(matchesSearch(pena, "Peña")).toBe(true);
    expect(matchesSearch(pena, "jose")).toBe(true);
  });

  it.each(["8", "08", "ATT-0008", "att-0008", "att8", "ATT 8"])(
    "finds ATT-0008 by %j, not ATT-0018",
    (text) => {
      expect(matchesSearch(pena, text)).toBe(true);
      expect(matchesSearch(ana2, text)).toBe(false);
    },
  );

  it("a partial reference finds IDs that start that way", () => {
    expect(matchesSearch(ana2, "ATT-001")).toBe(true);
    expect(matchesSearch(pena, "ATT-001")).toBe(false);
  });

  it("searches email and phone only when the row carries them", () => {
    const withContact = { ...ben, email: "ben.lim@example.com", phone: "+63 917 123 4567" };
    expect(matchesSearch(withContact, "ben.lim@")).toBe(true);
    expect(matchesSearch(withContact, "0917-123")).toBe(false); // the stored number has +63, not 0
    expect(matchesSearch(withContact, "917 123")).toBe(true);
    expect(matchesSearch(withContact, "4567")).toBe(true);
    // As a Viewer receives it: no email or phone on the row, so they can't be searched.
    expect(matchesSearch(ben, "ben.lim@")).toBe(false);
    expect(matchesSearch(ben, "4567")).toBe(false);
  });

  it("needs at least 3 digits to match a phone", () => {
    const withPhone = { ...ben, phone: "0917 123 4567" };
    expect(matchesSearch(withPhone, "45")).toBe(false);
    expect(matchesSearch(withPhone, "456")).toBe(true);
  });
});

describe("filterGuestList (B2-11)", () => {
  it("filters by category ignoring case", () => {
    expect(names(filterGuestList(all, q({ category: "Family" })))).toEqual([
      "Ana Reyes#1",
      "José Peña#8",
    ]);
  });

  it("filters by dietary needs recorded or not; blank counts as not recorded", () => {
    expect(names(filterGuestList(all, q({ dietary: "yes" })))).toEqual(["Ana Reyes#1"]);
    expect(names(filterGuestList(all, q({ dietary: "no" })))).toEqual([
      "Ben Lim#2",
      "José Peña#8",
      "ana reyes#18",
    ]);
  });

  it("filters by plus-ones", () => {
    expect(names(filterGuestList(all, q({ plusOnes: "yes" })))).toEqual([
      "Ana Reyes#1",
      "José Peña#8",
    ]);
    expect(names(filterGuestList(all, q({ plusOnes: "no" })))).toEqual([
      "Ben Lim#2",
      "ana reyes#18",
    ]);
  });

  it("combines search and every filter with AND", () => {
    expect(names(filterGuestList(all, q({ search: "ana", category: "Family" })))).toEqual([
      "Ana Reyes#1",
    ]);
    expect(
      names(filterGuestList(all, q({ category: "Family", plusOnes: "yes", rsvp: "MAYBE" }))),
    ).toEqual(["José Peña#8"]);
    expect(filterGuestList(all, q({ search: "ana", rsvp: "MAYBE" }))).toEqual([]);
  });

  it("returns everyone without criteria", () => {
    expect(filterGuestList(all, DEFAULT_QUERY)).toEqual(all);
  });
});

describe("sortGuestList (B2-12)", () => {
  it("sorts by name ignoring case, ties by ID", () => {
    expect(names(sortGuestList(all, "name", "asc"))).toEqual([
      "Ana Reyes#1",
      "ana reyes#18",
      "Ben Lim#2",
      "José Peña#8",
    ]);
    expect(names(sortGuestList(all, "name", "desc"))).toEqual([
      "José Peña#8",
      "Ben Lim#2",
      "ana reyes#18",
      "Ana Reyes#1",
    ]);
  });

  it("sorts by ID (order added) both ways", () => {
    expect(sortGuestList(all, "id", "asc").map((r) => r.number)).toEqual([1, 2, 8, 18]);
    expect(sortGuestList(all, "id", "desc").map((r) => r.number)).toEqual([18, 8, 2, 1]);
  });

  it("sorts RSVP as Confirmed, Pending, Maybe, Declined", () => {
    expect(sortGuestList(all, "rsvp", "asc").map((r) => r.rsvpStatus)).toEqual([
      "CONFIRMED",
      "PENDING",
      "MAYBE",
      "DECLINED",
    ]);
    expect(sortGuestList(all, "rsvp", "desc").map((r) => r.rsvpStatus)).toEqual([
      "DECLINED",
      "MAYBE",
      "PENDING",
      "CONFIRMED",
    ]);
  });

  it("sorts by plus-ones, ties by name ascending in both directions", () => {
    expect(names(sortGuestList(all, "plusones", "asc"))).toEqual([
      "ana reyes#18",
      "Ben Lim#2",
      "Ana Reyes#1",
      "José Peña#8",
    ]);
    expect(names(sortGuestList(all, "plusones", "desc"))).toEqual([
      "José Peña#8",
      "Ana Reyes#1",
      "ana reyes#18",
      "Ben Lim#2",
    ]);
  });

  it("sorts by category, attendees without one last in both directions", () => {
    expect(names(sortGuestList(all, "category", "asc"))).toEqual([
      "Ana Reyes#1",
      "José Peña#8",
      "Ben Lim#2",
      "ana reyes#18",
    ]);
    expect(names(sortGuestList(all, "category", "desc"))).toEqual([
      "Ben Lim#2",
      "Ana Reyes#1",
      "José Peña#8",
      "ana reyes#18",
    ]);
  });

  it("returns a copy and never changes the rows it was given", () => {
    const before = JSON.stringify(all);
    const sorted = sortGuestList(all, "id", "desc");
    expect(sorted).not.toBe(all);
    expect(JSON.stringify(all)).toBe(before);
  });
});

describe("applyGuestListQuery and helpers", () => {
  it("filters, then sorts", () => {
    expect(names(applyGuestListQuery(all, q({ search: "ana", sort: "id", dir: "desc" })))).toEqual([
      "ana reyes#18",
      "Ana Reyes#1",
    ]);
  });

  it("knows when the list is narrowed and describes the criteria", () => {
    expect(isNarrowed(q({ sort: "id" }))).toBe(false);
    expect(isNarrowed(q({ rsvp: "MAYBE" }))).toBe(true);
    expect(hasCriteriaBeyondRsvp(q({ rsvp: "MAYBE" }))).toBe(false);
    expect(hasCriteriaBeyondRsvp(q({ plusOnes: "no" }))).toBe(true);
    expect(
      describeCriteria(
        q({ search: "ana", rsvp: "MAYBE", category: "Family", dietary: "no", plusOnes: "yes" }),
      ),
    ).toEqual([
      "Search: “ana”",
      "RSVP: Maybe",
      "Category: Family",
      "No dietary needs recorded",
      "Bringing plus-ones",
    ]);
  });
});