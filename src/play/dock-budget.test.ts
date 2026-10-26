import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { armedLines, armedRoom, armedWords } from "./armed-room.ts";
import { DOCK_PAD_DENSE_PX, DOCK_PAD_PX, LABEL_PX, labelChars, linesPlace, PILL_PT, planWords, STEP_PX, titleLinesOf, TITLE_PX, wordsWindow } from "./dock-budget.ts";
import { dockLines } from "./dock-lines.ts";

// The dense dock's budget (phase 22): the step and one title line stay in view in the worst dock at 667x375 and 844x390.
type Row = { name: string; type: string };
function longestName(): string {
  const names = readdirSync("data/cards").flatMap((file) => (JSON.parse(readFileSync(`data/cards/${file}`, "utf8")) as Row[]).filter((card) => ["hero", "ally"].includes(card.type)).map((card) => card.name));
  return names.reduce((best, name) => (name.length > best.length ? name : best), "");
}
// READOUT and BUTTONS are constants taken from a web measurement of the dense dock (Chromium, 667x375, headless harness): a raised
// readout tile of a 30 pt numbers row and a three-line result, 4 pt of padding above and below (92 pt with its 4 pt gap); the
// primary (44), the secondary row (40) and the quiet row (40). They are not derived from the components, so re-measure them when
// the dock's rows change.
const READOUT = 4 + 30 + 54 + 4;
const BUTTONS = 44 + 40 + 40;
// The pinned block: readout, the armed room, the buttons, and the block's own 2 pt gap.
const block = (armed: number) => READOUT + 2 + armedRoom(armed, true) + BUTTONS;
// The command column's height: the screen less the 44 pt top bar and the 8 pt foot.
const column = (height: number) => height - 44 - 8;
const LONG = "Choose a defender for Gollum, Guide of the Dead Marshes";

describe("the dense dock's words window", () => {
  const worst = `Tap again: ${longestName()} falls and the game is lost`;
  const space = (height: number) => wordsWindow({ room: column(height), block: block(armedLines([armedWords(worst, true)])), dense: true });

  it("is the column less the dock's padding and the pinned block", () => {
    expect(wordsWindow({ room: 300, block: 200 })).toBe(300 - DOCK_PAD_PX - 200);
    expect(wordsWindow({ room: 300, block: 200, dense: true })).toBe(300 - DOCK_PAD_DENSE_PX - 200);
    expect(wordsWindow({ room: 100, block: 200 })).toBe(0);
  });

  it("holds the step and one full title line in the worst dock at 667x375 and 844x390, with the longest card name in the caution", () => {
    for (const height of [375, 390]) {
      expect(space(height), `${height} tall`).toBeGreaterThanOrEqual(STEP_PX + TITLE_PX);
      const plan = planWords({ space: space(height), dense: true, title: LONG, textWidth: 168, hasLine: true, foldable: true });
      expect(plan.titleLines).toBeGreaterThanOrEqual(1);
      expect(STEP_PX + plan.titleLines * TITLE_PX + (plan.showLine ? LABEL_PX : 0)).toBeLessThanOrEqual(space(height));
    }
  });

  it("clamps a long title to the lines that fit and cuts it, never to fewer than one", () => {
    const wide = planWords({ space: STEP_PX + 2 * TITLE_PX + LABEL_PX, dense: true, title: LONG, textWidth: 168, hasLine: true, foldable: false });
    expect(wide).toMatchObject({ titleLines: 2, cut: false, showLine: true });
    const tight = planWords({ space: STEP_PX + TITLE_PX + LABEL_PX, dense: true, title: LONG, textWidth: 168, hasLine: true, foldable: false });
    expect(tight).toMatchObject({ titleLines: 1, cut: true, showLine: true, pill: true, pillOnTitle: false });
  });

  it("drops the folded line and puts the pill on the title row when the room cannot hold the step, a title line and a label line", () => {
    const plan = planWords({ space: STEP_PX + TITLE_PX + LABEL_PX - 1, dense: true, title: "Defend", textWidth: 168, hasLine: true, foldable: false });
    expect(plan).toMatchObject({ showLine: false, pill: true, pillOnTitle: true, titleLines: 1 });
    // No room at all still leaves one title line.
    expect(planWords({ space: 5, dense: true, title: "Defend", textWidth: 168, hasLine: true, foldable: true }).titleLines).toBe(1);
    // No line and a title that fits: no pill.
    expect(planWords({ space: 60, dense: true, title: "Defend", textWidth: 168, hasLine: false, foldable: false }).pill).toBe(false);
  });

  it("counts a title on the title row against the width the pill leaves", () => {
    const title = "Choose a defender";
    expect(titleLinesOf(title, 168)).toBe(1);
    expect(titleLinesOf(title, 168 - PILL_PT)).toBe(2);
    const plan = planWords({ space: STEP_PX + TITLE_PX + LABEL_PX - 1, dense: true, title, textWidth: 168, hasLine: true, foldable: true });
    expect(plan).toMatchObject({ showLine: false, pillOnTitle: true, titleLines: 1, cut: true });
  });

  it("leaves a taller screen as it was: the title's own lines, the folded line, the pill beside it", () => {
    expect(planWords({ space: 10, dense: false, title: LONG, textWidth: 168, hasLine: true, foldable: true })).toMatchObject({ titleLines: 2, cut: false, showLine: true, pill: true, pillOnTitle: false });
  });

  it("counts a long title's lines at the dock's width, two at most, and a line's characters from its width", () => {
    expect(titleLinesOf(LONG, 168)).toBe(2);
    expect(titleLinesOf("Defend", 168)).toBe(1);
    expect(labelChars(168 - PILL_PT)).toBe(Math.floor(138 / 6.6));
  });
});

describe("the \"i\" popover's room", () => {
  const lines = dockLines({
    guide: "Each enemy attacks: declare one defender, or take it undefended on a hero.",
    note: "Defense is subtracted from the attack.",
    unavailable: [
      { id: "a", label: "Frodo", code: null, reason: "exhausted" },
      { id: "b", label: "Pippin", code: null, reason: "defended already" },
    ],
  });

  it("holds the full title, a guide, a note and two refusals without scrolling at 667x375", () => {
    const place = linesPlace({ screenWidth: 667, screenHeight: 375, commandWidth: 210, insetLeft: 0, insetRight: 0, top: 47 });
    const chars = Math.floor((place.width - 28) / 6.6);
    const rows = [lines.first, ...lines.rest].reduce((sum, line) => sum + Math.ceil((line?.text.length ?? 0) / chars), 0);
    const height = 2 * TITLE_PX + 3 * 4 + rows * LABEL_PX + 10;
    expect(height, `${rows} rows in ${place.width} pt`).toBeLessThanOrEqual(place.maxHeight - 48 - 8);
  });
});
