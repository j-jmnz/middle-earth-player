import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, type Plugin } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

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
      "src/rules/**/*.test.ts",
      "src/campaign/**/*.test.ts",
      "src/effects/**/*.test.ts",
      "src/catalog/**/*.test.ts",
      "src/screens/**/*.test.ts",
      "src/play/**/*.test.ts",
      "scripts/**/*.test.ts",
    ],
    passWithNoTests: true,
    // Most files import the effect list and data/; one module cache per worker loads them once instead of once per file.
    // A test that changes module state or the environment puts it back (vi.unstubAllEnvs, afterEach).
    isolate: false,
    // The main process only collects results, so every core runs a worker (the card smoke sweep is split for them).
    maxWorkers: "100%",
  },
});
