// The focus ring is a graphic the player must see (WCAG 1.4.11, 3:1; 2.4.7): accentHigh on the night, raised and dock grounds, ink on paper and
// parchment, in both themes (docs/design-system-table.md, Screen reader). Paper is the same in both themes, where accentHigh on it is about 1:1.
import { describe, expect, it } from "vitest";

import { luminance } from "./colour-math.ts";
import { ringColorOf } from "../../ui/focus-ring-style.ts";
import { tableTokensByTheme, type TableTokens } from "../../ui/tokens.ts";

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

// The grounds a ring stands on: the night (the table, and the dock, which stands on the command column's fade to it), the raised plates and
// panels, the raised top edge; and the paper surfaces (a sheet, parchment, the pressed paper).
const DARK_GROUNDS: readonly (keyof TableTokens)[] = ["night", "raised", "raisedTop"];
const PAPER_GROUNDS: readonly (keyof TableTokens)[] = ["paper", "paperPressed"];

describe("the focus ring's contrast", () => {
  for (const theme of ["dark", "light"] as const) {
    const t = tableTokensByTheme[theme];
    it(`is at least 3:1 on the night, raised and dock grounds in ${theme}`, () => {
      for (const ground of DARK_GROUNDS) expect(contrast(ringColorOf(t, false), t[ground]), `${theme} ${ground}`).toBeGreaterThanOrEqual(3);
    });
    it(`is at least 3:1 on paper and parchment in ${theme}, drawn in ink`, () => {
      expect(ringColorOf(t, true)).toBe(t.ink);
      for (const ground of PAPER_GROUNDS) expect(contrast(ringColorOf(t, true), t[ground]), `${theme} ${ground}`).toBeGreaterThanOrEqual(3);
    });
  }

  it("would not be seen in accentHigh on paper in Dark", () => {
    const t = tableTokensByTheme.dark;
    expect(contrast(t.accentHigh, t.paper)).toBeLessThan(3);
  });
});
