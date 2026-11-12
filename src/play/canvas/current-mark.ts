// Rules: mec108.side-quests-in-play (data/rules/entries.json). Where the "Current" pill of the current quest sits on its card and what it says (docs/design-system-table.md, Cards, Intruders in Chetwood). Pure, so a test reads it.
import type { Rect } from "../layout/layout.ts";
import { TOKEN } from "./token-spots.ts";

/** The pill's box: the word when it fits left of the damage token's column ("word"), else a small dot ("dot"). It lies inside the card's top edge, so a card in the row above or below never covers it. */
export type CurrentMark = { kind: "word" | "dot"; x: number; y: number; width: number; height: number };

/** `wordWidth` is the "Current" text's width in the badge font, `pill` the badge height, `s` the UI scale. The pill's right edge stops at the damage token's left edge, so it never lies on it whatever the card's width. */
export function currentMark(rect: Rect, wordWidth: number, pill: number, s: number): CurrentMark {
  const right = rect.x + rect.w - (TOKEN + 2) * s - 2 * s;
  const room = right - (rect.x + 2 * s);
  const word = wordWidth + 10 * s;
  if (word <= room) return { kind: "word", x: right - word, y: rect.y + 1 * s, width: word, height: pill };
  const dot = 9 * s;
  return { kind: "dot", x: Math.max(rect.x + 2 * s, right - dot), y: rect.y + 1 * s + (pill - dot) / 2, width: dot, height: dot };
}
