import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

// The type and radius tokens are rem, so the UI scale (the root layout sets NativeWind's rem to 14 times the factor) resizes them.
// Pill is a fixed 999, a shape and not a size.
const require = createRequire(import.meta.url);
const config = require("../../tailwind.config.js") as { theme: { extend: Record<string, Record<string, unknown>> } };
const REM = /^-?\d+(\.\d+)?rem$/;
const isRem = (value: unknown) => typeof value === "string" && (REM.test(value) || value === "0");

describe("tailwind.config.js", () => {
  it("writes every font size, line height and letter spacing in rem", () => {
    for (const [name, value] of Object.entries(config.theme.extend.fontSize!)) {
      const [size, extras] = value as [string, { lineHeight: string; letterSpacing?: string }];
      expect(isRem(size), `${name} size`).toBe(true);
      expect(isRem(extras.lineHeight), `${name} line height`).toBe(true);
      if (extras.letterSpacing !== undefined) expect(isRem(extras.letterSpacing), `${name} tracking`).toBe(true);
    }
  });

  it("writes every radius but pill in rem", () => {
    const radii = config.theme.extend.borderRadius!;
    for (const [name, value] of Object.entries(radii)) {
      if (name === "pill") expect(value).toBe("999px");
      else expect(isRem(value), name).toBe(true);
    }
  });

  it("keeps the 44 pt hit floor fixed", () => {
    expect(config.theme.extend.minHeight!.touch).toBe("44px");
    expect(config.theme.extend.minWidth!.touch).toBe("44px");
  });
});
