// eslint.config.mjs
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

// Import boundaries (AGENTS section 4) use no-restricted-imports, which needs no module resolver.
// Convention: inside a context use relative imports; reach another context only via
// "@/modules/<context>/public". Cycle detection (import/no-cycle) is not enabled yet, see
// docs/decisions/0005-module-layout.md.

const LAYERED = ["accessibility", "budget", "impact", "health", "import"];
const UPSTREAM = ["events", "members", "audit", "attendees", "suppliers", "tasks"];
const EXT = "{ts,tsx}";

const FRAMEWORK = ["react", "react-dom", "next", "next/**"];
const DB = ["@prisma/*", "pg", "@/generated/**", "@/lib/db"];

const ban = (group, message) => ({ group, message });

const CROSS = ban(
  ["@/modules/*/**", "!@/modules/*/public"],
  "Use another context only through its public.ts. Inside a context, use relative imports.",
);
const DOWNSTREAM = ban(
  ["@/modules/impact/**", "@/modules/health/**", "@/modules/import/**"],
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
    "no-restricted-globals": ["error", { name: "fetch", message: "No network calls in pure code." }],
    "no-restricted-syntax": [
      "error",
      {
        selector: "NewExpression[callee.name='Date'][arguments.length=0]",
        message: "Inject a clock instead of new Date().",
      },
    ],
  },
});

const contextBlocks = (ctx) => {
  const root = `src/modules/${ctx}`;
  const up = UPSTREAM.includes(ctx) ? [DOWNSTREAM] : [];
  const blocks = [];

  if (LAYERED.includes(ctx)) {
    blocks.push(
      restrict(`${root}/domain/**/*.${EXT}`, [
        ban(["@/modules/**"], "domain imports only shared/kernel and its own domain (relative)."),
        ban(["@/lib/**", "@/components/**", "@/app/**"], "domain must not depend on framework glue."),
        ban(DB, "domain must not touch the database."),
        ban(FRAMEWORK, "domain must stay free of React and Next.js."),
        ban(["**/application/**", "**/infrastructure/**", "**/ui/**"], "domain must not depend on outer layers."),
        ...up,
      ]),
      deterministic(`${root}/domain/**/*.${EXT}`),
      restrict(`${root}/application/**/*.${EXT}`, [
        CROSS,
        ban(FRAMEWORK, "application must stay free of React and Next.js."),
        ban(["@/components/**", "@/app/**"], "application must not import UI."),
        ban([...DB, "@/lib/env.server"], "application reaches data only through ports."),
        ban(["**/infrastructure/**", "**/ui/**"], "application must not import infrastructure or ui."),
        ...up,
      ]),
      restrict(`${root}/infrastructure/**/*.${EXT}`, [
        CROSS,
        ban(["react", "react-dom"], "infrastructure must not import React."),
        ban(["**/ui/**", "@/components/**", "@/app/**"], "infrastructure must not import UI."),
        ...up,
      ]),
    );
  }

  blocks.push(
    restrict(`${root}/ui/**/*.${EXT}`, [
      CROSS,
      SERVER_ONLY,
      ban(["@/app/**"], "ui must not import pages."),
      ...up,
    ]),
    restrict(`${root}/*.${EXT}`, [CROSS, ...up]),
  );

  return blocks;
};

const allContexts = [...UPSTREAM, ...LAYERED];

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
      ["@/lib/**", "@/components/**", "@/app/**", "@/modules/**", "@/generated/**", "@prisma/*", "pg", ...FRAMEWORK],
      "shared/kernel is pure and imports nothing from the app.",
    ),
  ]),
  deterministic(`src/shared/kernel/**/*.${EXT}`),
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
