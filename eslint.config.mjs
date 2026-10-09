// eslint.config.mjs
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

// Import boundaries use no-restricted-imports, which needs no module resolver.
// Layout: every bounded context lives under src/modules/events/. The "events" context owns the
// top-level files of that folder; every other context is a sub-folder, e.g.
// src/modules/events/attendees.
// Convention: inside a context use relative imports; reach another context only through its
// public.ts: "@/modules/events/public" or "@/modules/events/<context>/public".
// Cycle detection (import/no-cycle) is not enabled yet. See docs/DECISIONS.md, D-001.

const MODULES_DIR = "src/modules/events";
const MODULES_ALIAS = "@/modules/events";

const LAYERED = ["accessibility", "budget", "impact", "health", "import"];
const UPSTREAM = [
  "events",
  "members",
  "audit",
  "attendees",
  "suppliers",
  "tasks",
  "checkin",
  "volunteers",
  "timeline",
];
const DOWNSTREAM_CONTEXTS = ["impact", "health", "import"];
const EXT = "{ts,tsx}";

const FRAMEWORK = ["react", "react-dom", "next", "next/**"];
const DB = ["@prisma/*", "pg", "@/generated/**", "@/lib/db"];

const ban = (group, message) => ({ group, message });

// A regex, not a gitignore group: "!" exceptions cannot re-allow a path once "@/modules/**" has
// excluded its parent folder. Allowed: @/modules/events/public and @/modules/events/<context>/public.
const CROSS = {
  regex: "^@/modules/(?!events/(?:[^/]+/)?public$)",
  message:
    "Use another context only through its public.ts. Inside a context, use relative imports.",
};
const DOWNSTREAM = ban(
  DOWNSTREAM_CONTEXTS.flatMap((ctx) => [`${MODULES_ALIAS}/${ctx}/**`, `../**/${ctx}/**`]),
  "Upstream contexts must not import impact, health or import.",
);
const SERVER_ONLY = ban(
  [...DB, "@/lib/env.server", "**/infrastructure/**"],
  "Server-only code must not be imported here.",
);

const restrict = (files, groups) => ({
  files: [files],
  rules: { "no-restricted-imports": ["error", { patterns: groups }] },
});

const deterministic = (files) => ({
  files: [files],
  rules: {
    "no-restricted-properties": [
      "error",
      { object: "Date", property: "now", message: "Inject a clock instead of Date.now()." },
      { object: "Math", property: "random", message: "Inject ids or randomness instead." },
    ],
    "no-restricted-globals": [
      "error",
      { name: "fetch", message: "No network calls in pure code." },
    ],
    "no-restricted-syntax": [
      "error",
      {
        selector: "NewExpression[callee.name='Date'][arguments.length=0]",
        message: "Inject a clock instead of new Date().",
      },
    ],
  },
});

const allContexts = [...UPSTREAM, ...LAYERED];
const subContexts = allContexts.filter((ctx) => ctx !== "events");

// Sub-contexts are siblings, so "../suppliers/schema" would skip the public.ts rule.
// Ban relative paths that walk into another context's folder.
const siblings = (ctx) =>
  ban(
    subContexts
      .filter((other) => other !== ctx)
      .flatMap((other) => (ctx === "events" ? [`./${other}/**`] : [`../**/${other}/**`])),
    `Use another context only through ${MODULES_ALIAS}/<context>/public, not a relative path.`,
  );

const contextBlocks = (ctx) => {
  const root = ctx === "events" ? MODULES_DIR : `${MODULES_DIR}/${ctx}`;
  const up = UPSTREAM.includes(ctx) ? [DOWNSTREAM] : [];
  const sib = siblings(ctx);
  const blocks = [];

  if (LAYERED.includes(ctx)) {
    blocks.push(
      restrict(`${root}/domain/**/*.${EXT}`, [
        ban(["@/modules/**"], "domain imports only shared/kernel and its own domain (relative)."),
        ban(
          ["@/lib/**", "@/components/**", "@/app/**"],
          "domain must not depend on framework glue.",
        ),
        ban(DB, "domain must not touch the database."),
        ban(FRAMEWORK, "domain must stay free of React and Next.js."),
        ban(
          ["**/application/**", "**/infrastructure/**", "**/ui/**"],
          "domain must not depend on outer layers.",
        ),
        sib,
        ...up,
      ]),
      deterministic(`${root}/domain/**/*.${EXT}`),
      restrict(`${root}/application/**/*.${EXT}`, [
        CROSS,
        ban(FRAMEWORK, "application must stay free of React and Next.js."),
        ban(["@/components/**", "@/app/**"], "application must not import UI."),
        ban([...DB, "@/lib/env.server"], "application reaches data only through ports."),
        ban(
          ["**/infrastructure/**", "**/ui/**"],
          "application must not import infrastructure or ui.",
        ),
        sib,
        ...up,
      ]),
      restrict(`${root}/infrastructure/**/*.${EXT}`, [
        CROSS,
        ban(["react", "react-dom"], "infrastructure must not import React."),
        ban(["**/ui/**", "@/components/**", "@/app/**"], "infrastructure must not import UI."),
        sib,
        ...up,
      ]),
    );
  }

  blocks.push(
    restrict(`${root}/ui/**/*.${EXT}`, [
      CROSS,
      SERVER_ONLY,
      ban(["@/app/**"], "ui must not import pages."),
      sib,
      ...up,
    ]),
    restrict(`${root}/*.${EXT}`, [CROSS, sib, ...up]),
  );

  return blocks;
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "no-console": "error",
    },
  },
  restrict(`src/shared/kernel/**/*.${EXT}`, [
    ban(
      [
        "@/lib/**",
        "@/components/**",
        "@/app/**",
        "@/modules/**",
        "@/generated/**",
        "@prisma/*",
        "pg",
        ...FRAMEWORK,
      ],
      "shared/kernel is pure and imports nothing from the app.",
    ),
  ]),
  deterministic(`src/shared/kernel/**/*.${EXT}`),
  // Baseline for any module file, including a new context not yet listed above. The specific
  // context blocks below replace it for the files they match.
  restrict(`src/modules/**/*.${EXT}`, [CROSS]),
  ...allContexts.flatMap(contextBlocks),
  restrict(`src/app/**/*.${EXT}`, [
    ban(
      ["**/domain/**", "**/application/**", "**/infrastructure/**", "**/composition", ...DB],
      "Pages compose actions, queries and ui only.",
    ),
  ]),
  restrict(`src/lib/**/*.${EXT}`, [
    ban(["@/modules/**"], "lib is framework glue and must not import modules."),
  ]),
  restrict(`src/components/**/*.${EXT}`, [
    ban(["@/modules/**"], "Shared components must not import modules."),
    SERVER_ONLY,
  ]),
  prettier,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "src/generated/**"]),
]);

export default eslintConfig;
