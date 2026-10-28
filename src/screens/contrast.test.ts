import { describe, expect, it } from "vitest";

import { palettes, type Palette } from "./palette.js";

// WCAG 2.x contrast (user request, 2026-10-28: a Light theme that reads as well as Dark). Body text needs 4.5:1.
function luminance(hex: string): number {
  const value = Number.parseInt(hex.slice(1), 16);
  const channel = (shift: number) => {
    const c = ((value >> shift) & 255) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

type Token = keyof Palette;
const PAIRS: readonly (readonly [text: Token, ground: Token])[] = [
  ["bone", "night"], ["bone", "raised"], ["bone", "raisedTop"],
  ["muted", "night"], ["muted", "raised"], ["muted", "raisedTop"],
  ["faint", "night"], ["faint", "raised"], ["faint", "raisedTop"],
  ["gold", "night"], ["gold", "raised"], ["goldHigh", "night"],
  ["onGold", "gold"], ["onGold", "goldHigh"],
  ["danger", "night"], ["danger", "raised"], ["danger", "raisedTop"], ["danger", "pressed"],
  ["faint", "pressed"], ["moon", "pressed"], ["gold", "pressed"],
  ["moon", "night"], ["ok", "night"],
  ["ink", "paper"], ["inkMuted", "paper"],
  ["onThreat", "threat"],
];

// Graphics and large marks need 3:1 (WCAG 1.4.11): the dashed slots, path segments and frames drawn in goldLine.
const GRAPHIC_PAIRS: readonly (readonly [Token, Token])[] = [["goldLine", "night"], ["goldLine", "raised"]];

// Dark's faint is 4.48:1 on raisedTop and 4.10:1 on pressed, under 4.5. Dark does not change (user request, 2026-10-28), so those two pairs
// are held at their real values (rounded down) and named here (so is onThreat on threat, 3.96:1, large bold numerals); the Daylight palette meets 4.5 on every pair.
const DARK_EXCEPTIONS: Readonly<Record<string, number>> = { "faint on raisedTop": 4.4, "faint on pressed": 4.1, "onThreat on threat": 3.9 };

describe("palette contrast", () => {
  for (const theme of ["dark", "light"] as const) {
    describe(theme, () => {
      for (const [text, ground] of PAIRS) {
        const floor = (theme === "dark" ? DARK_EXCEPTIONS[`${text} on ${ground}`] : undefined) ?? 4.5;
        it(`${text} on ${ground} is at least ${floor}:1`, () => {
          const palette = palettes[theme];
          expect(contrast(palette[text], palette[ground])).toBeGreaterThanOrEqual(floor);
        });
      }
    });
  }

  // goldLine is a Light-only floor: Dark's dim line is a quiet rule by design and does not change.
  describe("light graphics", () => {
    for (const [mark, ground] of GRAPHIC_PAIRS) {
      it(`${mark} on ${ground} is at least 3:1`, () => {
        expect(contrast(palettes.light[mark], palettes.light[ground])).toBeGreaterThanOrEqual(3);
      });
    }
  });
});
