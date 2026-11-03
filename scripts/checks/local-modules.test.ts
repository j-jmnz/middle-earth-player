import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// The local Expo modules under modules/ (docs/architecture.md, Modules). Expo autolinking links a module on iOS only through a
// podspec in its ios folder and on Android only through its build.gradle; without one the module is left out of that app, and
// requireOptionalNativeModule returns null there with no build error.
const MODULES_DIR = path.join(import.meta.dirname, "..", "..", "modules");
const modules = readdirSync(MODULES_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(path.join(MODULES_DIR, entry.name, "expo-module.config.json")))
  .map((entry) => entry.name);

function platformsOf(name: string): string[] {
  const config = JSON.parse(readFileSync(path.join(MODULES_DIR, name, "expo-module.config.json"), "utf8")) as { platforms?: string[] };
  return config.platforms ?? [];
}

describe("local Expo modules", () => {
  it("finds the modules", () => {
    expect(modules).toEqual(expect.arrayContaining(["booklet-pdf", "image-backup-exclusion"]));
  });

  it.each(modules)("%s carries what autolinking needs on each platform it names", (name) => {
    const platforms = platformsOf(name);
    if (platforms.includes("apple") || platforms.includes("ios")) {
      const ios = path.join(MODULES_DIR, name, "ios");
      expect(existsSync(ios) ? readdirSync(ios).filter((file) => file.endsWith(".podspec")) : []).toHaveLength(1);
    }
    if (platforms.includes("android")) {
      expect(existsSync(path.join(MODULES_DIR, name, "android", "build.gradle"))).toBe(true);
    }
  });
});
