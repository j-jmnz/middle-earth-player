import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { armedLines, armedRoom, armedWords, CHARS_PER_LINE, lineCount, MAX_LINES, MIN_LINES } from "./armed-room.ts";

// The armed line holds a caution in full at the narrowest dock (phase 22 ux fix): its room is sized to the longest words a dock
// button can say when armed, and is the same before and after arming.
type Row = { name: string; type: string };
function longestName(types: readonly string[]): string {
  const dir = "data/cards";
  const names = readdirSync(dir).flatMap((file) => (JSON.parse(readFileSync(`${dir}/${file}`, "utf8")) as Row[]).filter((card) => types.includes(card.type)).map((card) => card.name));
  return names.reduce((best, name) => (name.length > best.length ? name : best), "");
}

describe("the armed line's room", () => {
  it("counts lines by a word wrap", () => {
    expect(lineCount("Tap again to pass")).toBe(1);
    expect(lineCount("Tap again: Leave undefended. The attack goes undefended.")).toBe(3);
    expect(lineCount("a".repeat(CHARS_PER_LINE * 2 + 1))).toBe(3);
  });

  it("is as many lines as the longest words, none when nothing can be said, and never more than the cap", () => {
    expect(armedLines(["Tap again to pass", null, "The only choice now: one tap sends it"])).toBe(2);
    expect(armedLines(["Tap again to pass", null])).toBe(1);
    expect(armedLines(["Tap again to pass", null, "The only choice now: one tap sends it"], 40)).toBe(1);
    expect(armedLines([null, null])).toBe(MIN_LINES);
    expect(armedLines(["x ".repeat(200)])).toBe(MAX_LINES);
  });

  it("holds the longest loss caution the app builds (a hero or ally that falls and loses the game) within the cap, in full", () => {
    const name = longestName(["hero", "ally"]);
    const caution = `Tap again: ${name} falls and the game is lost`;
    expect(lineCount(caution), `${caution} fits ${MAX_LINES} lines`).toBeLessThanOrEqual(MAX_LINES);
    expect(armedLines([caution, "Tap again: pass until Combat"])).toBeGreaterThanOrEqual(lineCount(caution));
  });

  it("reserves the bar under the text, so arming adds nothing", () => {
    expect(armedRoom(2)).toBe(40);
    expect(armedRoom(3)).toBeGreaterThan(armedRoom(2));
  });

  it("drops the lead-in on a dense dock only from a consequence clause, and only when that takes a line off", () => {
    const clause = "Tap again: Sam Gamgee falls and the game is lost";
    expect(lineCount(clause)).toBe(3);
    expect(armedWords(clause, true)).toBe("Sam Gamgee falls and the game is lost");
    expect(lineCount(armedWords(clause, true))).toBe(2);
    // Not dense, no saving, a bare label and a clause with no loss all keep the words they have.
    expect(armedWords(clause, false)).toBe(clause);
    expect(armedWords("Tap again: Leave undefended", true)).toBe("Tap again: Leave undefended");
    expect(armedWords("Tap again: use it now and every time", true)).toBe("Tap again: use it now and every time");
    const same = `Tap again: ${longestName(["hero", "ally"])} falls and the game is lost`;
    expect(armedWords(same, true).endsWith("falls and the game is lost")).toBe(true);
  });
});
