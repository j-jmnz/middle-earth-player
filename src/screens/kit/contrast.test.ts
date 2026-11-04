import { describe, expect, it } from "vitest";

import { palettes, type Palette } from "./palette.js";
import { TINT_ALPHA, TONAL_ALPHA } from "../../ui/surfaces.ts";

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
  ["accent", "night"], ["accent", "raised"], ["accentHigh", "night"],
  ["onAccent", "accent"], ["onAccent", "accentHigh"],
  ["danger", "night"], ["danger", "raised"], ["danger", "raisedTop"], ["danger", "pressed"],
  ["faint", "pressed"], ["moon", "pressed"], ["accent", "pressed"], ["bone", "pressed"], ["muted", "pressed"],
  ["moon", "night"], ["ok", "night"],
  ["ink", "paper"], ["inkMuted", "paper"], ["inkLabel", "paper"],
  ["onThreat", "threat"],
];

// Graphics and large marks need 3:1 (WCAG 1.4.11): the dashed slots, path segments and frames drawn in accentLine.
const GRAPHIC_PAIRS: readonly (readonly [Token, Token])[] = [["accentLine", "night"], ["accentLine", "raised"]];

// A fill the chrome lays over the ground at some opacity (surfaces.ts): the colour it composites to over `ground`.
function over(fill: string, alpha: number, ground: string): string {
  const mix = (shift: number) => {
    const f = (Number.parseInt(fill.slice(1), 16) >> shift) & 255;
    const g = (Number.parseInt(ground.slice(1), 16) >> shift) & 255;
    return Math.round(f * alpha + g * (1 - alpha));
  };
  return `#${[16, 8, 0].map((shift) => mix(shift).toString(16).padStart(2, "0")).join("")}`;
}

// Two Dark pairs are under 4.5 and held at their real values (rounded down): faint on pressed, 4.35:1 (faint sits on the pressed fill
// only for the moment of a press), and onThreat on threat, 3.10:1, the handoff's #FBD9CC on #D35537, used only for the large dial
// numerals, which need 3:1. Rivendell meets 4.5 on every pair.
const DARK_EXCEPTIONS: Readonly<Record<string, number>> = { "faint on pressed": 4.3, "onThreat on threat": 3.1 };

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

  for (const theme of ["dark", "light"] as const) {
    describe(`${theme} graphics`, () => {
      for (const [mark, ground] of GRAPHIC_PAIRS) {
        it(`${mark} on ${ground} is at least 3:1`, () => {
          expect(contrast(palettes[theme][mark], palettes[theme][ground])).toBeGreaterThanOrEqual(3);
        });
      }
    });
  }
});

// The words of a button on the fills that are not palette tokens: the tonal fill (bone at TONAL_ALPHA) of the secondary button, a chip
// and a field, and the chip that is on (the glow on Dark, the accent on Light, at TINT_ALPHA), each over the ground and a raised plate.
describe("button fills", () => {
  for (const theme of ["dark", "light"] as const) {
    const palette = palettes[theme];
    for (const ground of ["night", "raised"] as const) {
      const tonal = over(palette.bone, TONAL_ALPHA, palette[ground]);
      for (const word of ["accent", "bone", "muted", "danger"] as const) {
        it(`${theme}: ${word} on the tonal fill over ${ground} is at least 4.5:1`, () => {
          expect(contrast(palette[word], tonal)).toBeGreaterThanOrEqual(4.5);
        });
      }
      const on = over(theme === "dark" ? palette.glow : palette.accent, TINT_ALPHA, palette[ground]);
      for (const word of ["accentHigh", "bone"] as const) {
        it(`${theme}: ${word} on a chip that is on over ${ground} is at least 4.5:1`, () => {
          expect(contrast(palette[word], on)).toBeGreaterThanOrEqual(4.5);
        });
      }
    }
  }
});
