import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { configDefaults, defineConfig, type Plugin } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

// The files that play many whole games or compile every component.
// `pnpm test fast` (VITEST_FAST=1) leaves them out; `pnpm test` and CI run them.
const slowFiles = [
  "scripts/card-smoke/**",
  "src/play/compiler.test.ts",
  "src/campaign/fixtures.test.ts",
  "src/play/choice/*-sheets.test.ts",
];

function inlineSql(): Plugin {
  return {
    name: "inline-sql",
    enforce: "pre",
    load(id) {
      const filePath = id.split("?")[0] ?? id;
      if (!filePath.endsWith(".sql")) return null;
      return `export default ${JSON.stringify(fs.readFileSync(filePath, "utf8"))};`;
    },
  };
}

export default defineConfig({
  plugins: [inlineSql()],
  resolve: {
    alias: {
      "@": path.resolve(root, "src"),
    },
  },
  test: {
    environment: "node",
    include: [
      "src/**/*.test.ts",
      "scripts/**/*.test.ts",
      "test/**/*.test.ts",
    ],
    exclude: process.env.VITEST_FAST ? [...configDefaults.exclude, ...slowFiles] : configDefaults.exclude,
    passWithNoTests: true,
    // Most files import the effect list and data/; one module cache per worker loads them once instead of once per file.
    // A test that changes module state or the environment puts it back (vi.unstubAllEnvs, afterEach).
    isolate: false,
    // The main process only collects results, so every core runs a worker (the card smoke sweep is split for them).
    maxWorkers: "100%",
  },
});
