// Rules: mec108.side-quests-in-play (data/rules/entries.json). Where the "Current" pill of the current quest sits on its card and what it says (docs/design-system-table.md, Cards, Intruders in Chetwood). Pure, so a test reads it.
import type { Rect } from "../layout/layout.ts";
import { TOKEN } from "./token-spots.ts";

/** The pill's box: the word when it fits between the effect badges' column and the damage token's column ("word"), else a small dot ("dot"). It lies inside the card's top edge, so a card in the row above or below never covers it. */
export type CurrentMark = { kind: "word" | "dot"; x: number; y: number; width: number; height: number };

/**
 * `wordWidth` is the text's width in the badge font, `pill` the badge height, `s` the UI scale. The pill's right edge stops at the damage token's left edge and its left edge at `clear`, how far the card's widest effect badge reaches from the card's left edge
 * (0 for a card with none), so it never lies on either whatever the card's width. `short` is the glyph a dot says in place of the plain dot: a round pill the badge's height, so two words that fall back to the dot still differ without colour.
 */
export function currentMark(rect: Rect, wordWidth: number, pill: number, s: number, clear = 0, short = false): CurrentMark {
  const right = rect.x + rect.w - (TOKEN + 2) * s - 2 * s;
  const left = rect.x + Math.max(2 * s, clear + 2 * s);
  const room = right - left;
  const word = wordWidth + 10 * s;
  if (word <= room) return { kind: "word", x: right - word, y: rect.y + 1 * s, width: word, height: pill };
  const dot = short ? pill : 9 * s;
  return { kind: "dot", x: Math.max(left, right - dot), y: rect.y + 1 * s + (pill - dot) / 2, width: dot, height: dot };
}
