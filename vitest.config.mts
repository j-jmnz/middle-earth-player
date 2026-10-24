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
      "scripts/**/*.test.ts",
    ],
    passWithNoTests: true,
  },
});
