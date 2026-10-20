// src/modules/events/impact/domain/rules/task-review.ts
// Related task impact (B7-F07; D-101 point 6, D-102). Tasks have no link to an area yet, so a task
// is related when it is not Done and its title or description mentions one of a fixed, documented
// list of words for the areas an attendance change affects. Accents and capitals are ignored; whole
// words only, with simple plurals and the listed stems ("seat" also matches "seating").
//
//   one or more related tasks → Needs attention ("may need review"), each listed by its ID
//   none                      → Passed
//
// A word match is a hint, not a fact: the item says "may need review". Pure.
import type { ImpactItem } from "../impact-item";
import type { RuleContext } from "../registry";

/** The approved word list (D-102) as patterns, with the area word each one reports. */
export const TASK_KEYWORDS: readonly { word: string; pattern: RegExp }[] = [
  { word: "catering", pattern: /\bcater\w*/ },
  { word: "food", pattern: /\bfoods?\b/ },
  { word: "seats", pattern: /\bseat\w*/ },
  { word: "chairs", pattern: /\bchairs?\b/ },
  { word: "tables", pattern: /\btables?\b/ },
  { word: "guests", pattern: /\bguests?\b/ },
  { word: "headcount", pattern: /\bhead ?counts?\b/ },
  { word: "RSVPs", pattern: /\brsvps?\b/ },
  { word: "accessibility", pattern: /\baccessib\w*/ },
  { word: "wheelchairs", pattern: /\bwheel ?chairs?\b/ },
  { word: "budget", pattern: /\bbudget\w*/ },
];

const normalize = (text: string) =>
  text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** The listed words a text mentions, in list order. */
export function mentionedKeywords(text: string): string[] {
  const plain = normalize(text);
  return TASK_KEYWORDS.filter(({ pattern }) => pattern.test(plain)).map(({ word }) => word);
}

const list = (words: readonly string[]) =>
  words.length <= 1
    ? (words[0] ?? "")
    : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;

export function taskReviewRule({ state }: RuleContext): ImpactItem[] {
  const base = { key: "related-tasks", area: "TASKS", basis: "RECORDED", assumptions: [] } as const;
  const related = state.tasks
    .filter((task) => !task.done)
    .map((task) => ({
      task,
      words: mentionedKeywords(`${task.title}\n${task.description ?? ""}`),
    }))
    .filter(({ words }) => words.length > 0);

  if (related.length === 0) {
    return [
      {
        ...base,
        severity: "PASSED",
        title: "No open tasks mention the affected areas",
        reason:
          "No task that is not Done mentions catering, food, seats, chairs, tables, guests, headcount, RSVPs, accessibility, wheelchairs or the budget.",
        fix: null,
        references: [],
      },
    ];
  }

  const words = TASK_KEYWORDS.map((k) => k.word).filter((word) =>
    related.some((r) => r.words.includes(word)),
  );
  const count = related.length;
  return [
    {
      ...base,
      severity: "NEEDS_ATTENTION",
      title: `${count} ${count === 1 ? "task" : "tasks"} may need review`,
      reason: `${count === 1 ? "This open task mentions" : "These open tasks mention"} ${list(words)}, which this change may affect: ${related.map(({ task }) => `${task.reference} “${task.title}”`).join("; ")}.`,
      fix: { target: "tasks", label: "Open Tasks" },
      references: related.map(({ task }) => task.reference),
    },
  ];
}