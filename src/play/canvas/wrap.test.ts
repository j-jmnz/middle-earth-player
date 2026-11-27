import { describe, expect, it } from "vitest";

import { wrapName } from "./wrap.ts";

// One unit per character: a line of width 10 holds ten characters.
const measure = (text: string) => text.length;

describe("card names on the canvas", () => {
  it("wrap by word into lines that fit", () => {
    expect(wrapName("Gondorian Spearman", 10, measure)).toEqual(["Gondorian", "Spearman"]);
    expect(wrapName("Sam Gamgee", 10, measure)).toEqual(["Sam Gamgee"]);
  });

  it("stop at three lines and end the last with an ellipsis", () => {
    const lines = wrapName("Celebrimbor's Secret of the Elven Smiths", 10, measure);
    expect(lines).toHaveLength(3);
    expect(lines[2]?.endsWith("…")).toBe(true);
    for (const line of lines) expect(measure(line)).toBeLessThanOrEqual(10);
  });

  it("cut a word longer than the line", () => {
    expect(wrapName("Mablung-and-Damrod", 8, measure)).toEqual(["Mablung…"]);
  });

  it("keep the first line clear of a badge: a first word that does not fit it starts the second line", () => {
    // The Tamed Mûmak's damage token stands at the top right: the first line is 4 wide, the others 10.
    expect(wrapName("Tamed Mumak", 10, measure, 3, 4)).toEqual(["", "Tamed", "Mumak"]);
    expect(wrapName("Tamed Mumak", 12, measure, 3, 12)).toEqual(["Tamed Mumak"]);
    // A first word that fits the narrow line stays on it.
    expect(wrapName("Orc Guard", 10, measure, 3, 4)).toEqual(["Orc", "Guard"]);
  });

  it("do not leave the only line empty: a name of one line is cut at the narrow width", () => {
    expect(wrapName("Uruk Chieftain", 10, measure, 1, 4)).toEqual(["Uru…"]);
  });
});
