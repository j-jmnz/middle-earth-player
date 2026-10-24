import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function sourceFiles(directory: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      found.push(...sourceFiles(path));
      continue;
    }
    if (name.endsWith(".ts") || name.endsWith(".tsx")) found.push(path);
  }
  return found;
}

describe("boundaries", () => {
  it("keeps the reducer off the table, the network, and the effects folder", () => {
    const files = sourceFiles(join(process.cwd(), "src/rules"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      if (file.endsWith(".test.ts")) continue;
      const text = readFileSync(file, "utf8");
      expect(text).not.toMatch(/from ["']react-native/);
      expect(text).not.toMatch(/from ["']expo/);
      expect(text).not.toMatch(/src\/effects/);
      expect(text).not.toMatch(/src\/play/);
      expect(text).not.toMatch(/src\/screens/);
      expect(text).not.toMatch(/\bfetch\s*\(/);
      expect(text).not.toMatch(/Math\.random/);
      expect(text).not.toMatch(/better-sqlite3/);
    }
  });

  it("keeps node modules and scripts out of the rules and campaign modules that ship", () => {
    for (const directory of ["src/rules", "src/campaign"]) {
      for (const file of sourceFiles(join(process.cwd(), directory))) {
        if (file.endsWith(".test.ts")) continue;
        const text = readFileSync(file, "utf8");
        expect(text, file).not.toMatch(/from ["']node:/);
        expect(text, file).not.toMatch(/scripts\//);
      }
    }
  });

  // Phase 11 built the table. It sends intents and draws the reducer's state; it never reaches the screens or the campaign.
  it("keeps the table off src/screens and src/campaign", () => {
    const offenders = sourceFiles(join(process.cwd(), "src/play")).filter((path) => /from\s+["'][./]*\/(screens|campaign)\//.test(readFileSync(path, "utf8")));
    expect(offenders).toEqual([]);
  });
});