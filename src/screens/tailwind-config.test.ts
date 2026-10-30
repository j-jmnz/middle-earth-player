import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

import { CONTAINER_RADIUS, CONTROL_RADIUS, ITEM_RADIUS, SHEET_RADIUS } from "../play/radius.ts";

// The type and radius tokens are rem, so the UI scale (the root layout sets NativeWind's rem to 14 times the factor) resizes them.
// Control is a fixed 999, a capsule: a shape and not a size.
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

  it("has the four radii and no others: a capsule control, a 12 item, a 20 container and a 24 sheet", () => {
    const radii = config.theme.extend.borderRadius!;
    expect(Object.keys(radii).sort()).toEqual(["container", "control", "item", "sheet"]);
  });

  it("writes every radius but control in rem, the same points as src/play/radius.ts", () => {
    const radii = config.theme.extend.borderRadius!;
    expect(radii.control).toBe(`${CONTROL_RADIUS}px`);
    for (const [name, points] of [["item", ITEM_RADIUS], ["container", CONTAINER_RADIUS], ["sheet", SHEET_RADIUS]] as const) {
      expect(isRem(radii[name]), name).toBe(true);
      expect(Number.parseFloat(radii[name] as string) * 14, name).toBeCloseTo(points);
    }
  });

  it("keeps the 44 pt hit floor fixed", () => {
    expect(config.theme.extend.minHeight!.touch).toBe("44px");
    expect(config.theme.extend.minWidth!.touch).toBe("44px");
  });
});
