// Rules: mec108.side-quests-in-play (data/rules/entries.json); ledger line 09049:A:2. Where the "Current" pill lies on a card of any width: inside the card, never over the damage token's column.
import { describe, expect, it } from "vitest";

import { currentMark } from "./current-mark.ts";
import { TOKEN } from "./token-spots.ts";

const card = (w: number) => ({ x: 100, y: 50, w, h: w * 1.4 });
const WORD = 38;
const PILL = 14;

describe("the current-quest pill", () => {
  it("says the word left of the damage token's column on a card wide enough, inside its top edge", () => {
    const rect = card(110);
    const box = currentMark(rect, WORD, PILL, 1);
    expect(box.kind).toBe("word");
    expect(box.x).toBeGreaterThanOrEqual(rect.x);
    expect(box.x + box.width).toBeLessThanOrEqual(rect.x + rect.w - TOKEN - 2);
    expect(box.y).toBeGreaterThanOrEqual(rect.y);
  });

  it("never overlaps the damage token on a phone-width card, and below the width the word needs it draws a short mark instead", () => {
    for (const w of [90, 70, 56, 44, 30]) {
      const rect = card(w);
      const box = currentMark(rect, WORD, PILL, 1);
      expect(box.x + box.width, `w ${w}`).toBeLessThanOrEqual(Math.max(rect.x + rect.w - TOKEN - 2, rect.x + 2 + box.width));
      expect(box.x, `w ${w}`).toBeGreaterThanOrEqual(rect.x);
      expect(box.y, `w ${w}`).toBeGreaterThanOrEqual(rect.y);
    }
    expect(currentMark(card(90), WORD, PILL, 1).kind).toBe("word");
    expect(currentMark(card(56), WORD, PILL, 1).kind).toBe("dot");
  });

  it("scales with the UI scale", () => {
    const box = currentMark(card(110), WORD * 1.5, PILL * 1.5, 1.5);
    expect(box.kind).toBe("word");
    expect(box.height).toBe(PILL * 1.5);
  });
});
