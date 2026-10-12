// src/modules/events/action-coverage.test.ts
// @vitest-environment node
// Guard (B1-09, D-036): every server action that takes an event ID authorizes with authorizeEvent.
// Scans every "use server" file under src, so a future action that forgets the check fails here.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(process.cwd(), "src");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "generated" ? [] : files(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

/** Files whose first statement is the "use server" directive (comments may come first). */
const serverActionFiles = files(ROOT).filter((path) => {
  const code = readFileSync(path, "utf8").replace(/^(\s*\/\/[^\n]*\n|\s*\/\*[\s\S]*?\*\/)*/, "");
  return /^\s*["']use server["']/.test(code);
});

/** Exported functions whose first parameter is the event ID, with their bodies. */
function eventActions(source: string): { name: string; body: string }[] {
  const pattern = /export async function (\w+)\(\s*eventId\s*:/g;
  const starts = [...source.matchAll(pattern)];
  return starts.map((match, index) => ({
    name: match[1],
    body: source.slice(match.index, starts[index + 1]?.index ?? source.length),
  }));
}

describe("every event server action authorizes", () => {
  it("finds the server action files", () => {
    expect(serverActionFiles.map((path) => relative(ROOT, path)).sort()).toContain(
      "modules/events/actions.ts",
    );
  });

  const actions = serverActionFiles.flatMap((path) =>
    eventActions(readFileSync(path, "utf8")).map((action) => ({
      ...action,
      file: relative(ROOT, path),
    })),
  );

  it("finds the event actions (edit and delete so far)", () => {
    expect(actions.map((action) => action.name)).toEqual(
      expect.arrayContaining(["updateEventAction", "deleteEventAction"]),
    );
  });

  it.each(actions.map((action) => [`${action.file}: ${action.name}`, action] as const))(
    "%s calls authorizeEvent before anything else touches the event",
    (_label, action) => {
      expect(action.body).toMatch(/await authorizeEvent\(\s*eventId,/);
      // Nothing may load or change the event before authorizing.
      const before = action.body.slice(0, action.body.indexOf("authorizeEvent("));
      expect(before).not.toMatch(/getDb\(|getEventAccess\(|getEventForMember\(/);
    },
  );
});