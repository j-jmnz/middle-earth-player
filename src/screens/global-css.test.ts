import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { palettes, themeVars } from "./palette.js";

// global.css paints the static web export in Night before the app hydrates; it must be the dark palette, channel for channel.
describe("global.css :root defaults", () => {
  const css = fs.readFileSync(path.resolve(__dirname, "../../global.css"), "utf8");
  const root = /:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
  const declared = Object.fromEntries([...root.matchAll(/(--\w+):\s*([^;]+);/g)].map((match) => [match[1], match[2]?.trim()]));

  it("holds every dark token and no other variable", () => {
    expect(declared).toEqual(themeVars("dark"));
  });

  it("has a light twin with the same tokens", () => {
    expect(Object.keys(themeVars("light"))).toEqual(Object.keys(themeVars("dark")));
    expect(Object.keys(palettes.light)).toEqual(Object.keys(palettes.dark));
  });
});
