import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { armedLines, armedRoom, armedWords, CHARS_PER_LINE, lineCount, LEAD, MAX_LINES } from "./armed-room.ts";
import { DOCK_PAD_DENSE_PX, DOCK_PAD_PX, expandedHeight, foldedTitleLines, LABEL_PX, scrolls, STEP_PX, TITLE_PX, titleLinesOf, wordsWindow } from "./dock-budget.ts";

// The dense dock's budget (phase 22): the step and one title line stay in view in the worst dock at 667x375 and 844x390. The
// heights below are the pinned block's pieces as the dock lays them out when dense (measured on the web build).
type Row = { name: string; type: string };
function longestName(): string {
  const names = readdirSync("data/cards").flatMap((file) => (JSON.parse(readFileSync(`data/cards/${file}`, "utf8")) as Row[]).filter((card) => ["hero", "ally"].includes(card.type)).map((card) => card.name));
  return names.reduce((best, name) => (name.length > best.length ? name : best), "");
}
const READOUT = 4 + 30 + 54 + 4; // a result of three lines
const BUTTONS = 44 + 40 + 40; // primary, the secondary row, the quiet row
// The pinned block: readout, the armed room, the buttons, and the block's own 2 pt gap.
const block = (armed: number) => READOUT + 2 + armedRoom(armed, true) + BUTTONS;
// The command column's height: the screen less the 44 pt top bar and the 8 pt foot.
const column = (height: number) => height - 44 - 8;

describe("the dense dock's words window", () => {
  const worst = `Tap again: ${longestName()} falls and the game is lost`;
  const room = (height: number) => wordsWindow({ room: column(height), block: block(armedLines([armedWords(worst, true)])), dense: true });

  it("is the column less the dock's padding and the pinned block", () => {
    expect(wordsWindow({ room: 300, block: 200 })).toBe(300 - DOCK_PAD_PX - 200);
    expect(wordsWindow({ room: 300, block: 200, dense: true })).toBe(300 - DOCK_PAD_DENSE_PX - 200);
    expect(wordsWindow({ room: 100, block: 200 })).toBe(0);
  });

  it("leaves the step and one full title line in view in the worst dock, at 667x375 and 844x390, with the longest card name in the caution", () => {
    for (const height of [375, 390]) expect(room(height), `${height} tall`).toBeGreaterThanOrEqual(STEP_PX + TITLE_PX);
  });

  it("names the loss in full on a dense dock, and the lead-in only goes when that takes a line off", () => {
    const name = longestName();
    const short = armedWords(worst, true);
    expect(short.endsWith(`${name} falls and the game is lost`)).toBe(true);
    expect(lineCount(short)).toBeLessThanOrEqual(lineCount(worst));
    expect(lineCount(short)).toBeLessThanOrEqual(MAX_LINES);
    expect(armedWords(worst, false)).toBe(worst);
    expect(armedWords("Tap again to pass", true)).toBe("Tap again to pass");
    expect(armedWords(`${LEAD}${"x ".repeat(5)}`, true, CHARS_PER_LINE).length).toBeGreaterThan(0);
  });

  it("clamps a long title to the lines that fit, never under one, and leaves a taller screen's two lines alone", () => {
    expect(foldedTitleLines({ space: 45, dense: true, title: 2, folded: 1 })).toBe(1);
    expect(foldedTitleLines({ space: 20, dense: true, title: 2, folded: 1 })).toBe(1);
    expect(foldedTitleLines({ space: 16 + 18 + 48, dense: true, title: 2, folded: 1 })).toBe(2);
    expect(foldedTitleLines({ space: 10, dense: false, title: 2, folded: 1 })).toBe(2);
  });

  it("counts a long title's lines at the dock's width, two at most", () => {
    expect(titleLinesOf("Choose a defender for Gollum, Guide of the Dead Marshes", 168)).toBe(2);
    expect(titleLinesOf("Defend", 168)).toBe(1);
  });

  it("opens the lines in the room the title gives up: the realistic most (a guide, a note, two refusals) is counted in rows and scrolls only past the window", () => {
    const lines = [
      { rows: lineCount("Guide: Each enemy attacks: declare one defender, or take it undefended on a hero.", 20), refusal: false },
      { rows: lineCount("Defense is subtracted from the attack.", 20), refusal: false },
      { rows: 1, refusal: true },
      { rows: 2, refusal: true },
    ];
    const height = expandedHeight(lines);
    expect(height).toBe(lines.reduce((sum, line) => sum + line.rows, 0) * LABEL_PX + 8);
    // Opened the numbers' room is given too, so the window is the column less the padding and the buttons and the armed room.
    const opened = wordsWindow({ room: column(375), block: 2 + armedRoom(3, true) + BUTTONS, dense: true });
    expect(scrolls({ space: opened, title: 1, lines: height })).toBe(height + STEP_PX + TITLE_PX > opened);
    expect(scrolls({ space: opened, title: 1, lines: 2 * LABEL_PX })).toBe(false);
  });
});
