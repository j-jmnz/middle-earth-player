// The dock and the choice's rows at the phone's text size (docs/design-system.md, Type; docs/design-system-table.md, Command column,
// Choice tray): the budget counts the words, the pinned block and one row at the font scale, so the title, the buttons and a row stay in
// view at 667x375 and 844x390 up to a font scale of 2. The pinned block's rows are the sizes the components draw at a UI scale `s` and a
// font scale `text` (readout in dock/table-dock.tsx, buttons in ui/buttons.tsx): a text's line is its Medium line times both; a control keeps
// its 44 pt floor and grows with its word. No rule is implemented here.
import { describe, expect, it } from "vitest";

import { capLines, UI_SCALES } from "../../../ui/ui-scale.ts";
import { armedRoom } from "./armed-room.ts";
import { DOCK_PAD_DENSE_PX, DOCK_PAD_PX, isDense, planWords, smallPictures, TITLE_PX, trayRoom, wordsWindow } from "./budget.ts";

const TOP_BAR = 44;
const FOOT = 8;
const LONG = "Choose a defender for Gollum, Guide of the Dead Marshes";

// What the dock needs in a column, in screen points: the title, the dock's padding, one row and the pinned block (numbers row, one result
// line, the armed room, the primary, a secondary row and, when `quiet`, the row of reading aids; the tests leave that row out).
function need(a: { height: number; s: number; text: number; quiet: boolean }) {
  const { height, s, text, quiet } = a;
  const dense = isDense(height, s);
  const column = height - (TOP_BAR + FOOT) * s;
  const numbers = (24 * text + 6) * s;
  const result = 18 * text * s;
  const primary = Math.max(dense ? 44 : 46, 21 * text * s);
  const secondary = (dense ? 4 : 6) * s + Math.max(dense ? 40 * s : 44, 20 * text * s + 8 * s);
  const aids = quiet ? (dense ? 2 : 4) * s + Math.max(dense ? 40 * s : 44, 17 * text * s + 6) : 0;
  const block = numbers + result + 2 + armedRoom(0, dense, s, text) + primary + secondary + aids;
  const row = trayRoom(smallPictures(height, s), text) * s;
  const space = wordsWindow({ room: column, block: block + row, dense }, s);
  const plan = planWords({ space, dense, clamp: true, title: LONG, textWidth: 168 * s, hasLine: false, foldable: true, text }, s);
  const pad = (dense ? DOCK_PAD_DENSE_PX : DOCK_PAD_PX) * s;
  return { column, used: Math.max(plan.titleLines, 1) * TITLE_PX * text * s + pad + row + block, row, plan };
}

describe("the choice's rows and the dock at the phone's text size", () => {
  it("keeps Medium's room at a font scale of 1 and grows only when the name's line is taller than the picture's row", () => {
    expect(trayRoom(true)).toBe(59);
    expect(trayRoom(false)).toBe(84);
    expect(trayRoom(true, 1)).toBe(59);
    expect(trayRoom(true, 2)).toBe(59);
    expect(trayRoom(true, 3)).toBe(68);
    expect(armedRoom(2, true, 1, 1)).toBe(armedRoom(2, true));
    expect(armedRoom(2, true, 1, 2)).toBe(2 * 18 * 2 + 4);
  });

  it("keeps the title, the buttons and one row inside the column at Medium and font scale 2, on 844x390 and 667x375", () => {
    for (const height of [390, 375]) {
      const at = need({ height, s: UI_SCALES.medium, text: 2, quiet: false });
      expect(at.plan.titleLines, `${height} tall`).toBeGreaterThanOrEqual(1);
      expect(at.used, `${height} tall`).toBeLessThanOrEqual(at.column);
      expect(at.row, `${height} tall`).toBeGreaterThanOrEqual(59);
    }
  });

  it("keeps them at the Extra large UI scale at the phone's default text size, and at Medium for every font scale up to 2", () => {
    for (const height of [390, 375]) {
      const large = need({ height, s: UI_SCALES.xlarge, text: 1, quiet: false });
      expect(large.used, `${height} tall, Extra large`).toBeLessThanOrEqual(large.column);
      for (const text of [1, 1.15, 1.3, 1.5, 1.75, 2]) {
        const at = need({ height, s: UI_SCALES.medium, text, quiet: false });
        expect(at.used, `${height} tall, text ${text}`).toBeLessThanOrEqual(at.column);
      }
    }
  });
});

describe("the line caps", () => {
  it("keeps a cap at the phone's default text size and lifts it above", () => {
    expect(capLines(2, 1)).toBe(2);
    expect(capLines(3, 0.85)).toBe(3);
    expect(capLines(2, 1.15)).toBeUndefined();
    expect(capLines(1, 2)).toBeUndefined();
  });
});
