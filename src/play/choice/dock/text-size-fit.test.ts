// The dock and the choice's rows at the phone's text size (docs/design-system.md, Type; docs/design-system-table.md, Command column,
// Choice tray): the budget counts the words, the pinned block and one row at the font scale in the real column (fit.ts: the real top bar and
// foot), from what the components draw at a UI scale `s` and a font scale `text` (readout and refusal in dock/table-dock.tsx, buttons in
// ui/buttons.tsx). No rule is implemented here.
import { describe, expect, it } from "vitest";

import { capLines, UI_SCALES } from "../../../ui/ui-scale.ts";
import type { Readout } from "../../readouts/readout.ts";
import type { Dock, DockButton } from "../table-choice.ts";
import { armedRoom } from "./armed-room.ts";
import { trayRoom } from "./budget.ts";
import { foldAids } from "./extras.ts";
import { dockColumn, dockFit, dockTextWidth, type DockContent } from "./fit.ts";

const LONG = "Choose a defender for Gollum, Guide of the Dead Marshes";
const NO_INSETS = { top: 0, bottom: 0 };
const button = (label: string, testID: string, arm = false): DockButton => ({ label, action: { kind: "open", sheet: null } as unknown as DockButton["action"], arm, testID });
const ATTACK: Readout = { kind: "attack", stats: [{ icon: "attack", value: 3, word: "Attack" }, { icon: "defense", value: 2, word: "Defense" }], result: "Gollum takes 1 damage" };
const UNDO = { label: "Undo", testID: "table-undo", onPress: () => {} };
const READ = { label: "Read", testID: "sheet-inspect", onPress: () => {} };

// A moment as the dock draws it: the dock's buttons, a readout, a refusal and the quiet pills.
function moment(a: { primary: string; why?: string; answers?: readonly string[]; readout?: Readout; refusal?: string }): DockContent {
  const dock: Dock = { primary: button(a.primary, "sheet-primary"), why: a.why ?? null, secondary: (a.answers ?? []).map((label) => button(label, `sheet-${label}`)), single: false };
  return { dock, readout: a.readout ?? null, refusal: a.refusal ?? null, aids: ["Undo", "Read"], hasExtras: true };
}

// The width of the dock's words at the screen's width (command.ts: 30% of the screen, 210 to 280 pt).
const widthAt = (width: number, s: number) => dockTextWidth(Math.round(Math.min(280, Math.max(210, (width / s) * 0.3)) * s), s);
const SIZES = [
  { width: 844, height: 390 },
  { width: 667, height: 375 },
] as const;
// The moment the audit names: a disabled primary with its why line, one more answer, an attack readout.
const WORST = moment({ primary: "Leave undefended", why: "Choose at least one above.", answers: ["Cancel"], readout: ATTACK });
// A plain Pass with an attack readout and Cancel under it.
const PLAIN = moment({ primary: "Pass", answers: ["Cancel"], readout: ATTACK });

function fitAt(a: { size: (typeof SIZES)[number]; s: number; text: number; content: DockContent; folded: boolean }) {
  return dockFit({ height: a.size.height, s: a.s, text: a.text, insets: NO_INSETS, width: widthAt(a.size.width, a.s), content: a.content, trayOpen: true, folded: a.folded, title: LONG });
}

describe("the real column", () => {
  it("is the screen less the top bar under its room above, and the foot", () => {
    expect(dockColumn(375, 1, NO_INSETS)).toBe(375 - 8 - 52 - 8);
    // A top inset over the bar's room and a bottom inset over the foot's push the column in.
    expect(dockColumn(375, 1, { top: 24, bottom: 20 })).toBe(375 - 24 - 52 - 20);
    expect(dockColumn(375, 1.15, NO_INSETS)).toBeCloseTo(375 - 8 * 1.15 - 52 * 1.15 - 8 * 1.15);
  });
});

describe("the choice's rows at the phone's text size", () => {
  it("keeps Medium's room at a font scale of 1 and grows only when the name's line is taller than the picture's row", () => {
    expect(trayRoom(true)).toBe(59);
    expect(trayRoom(false)).toBe(84);
    expect(trayRoom(true, 1)).toBe(59);
    expect(trayRoom(true, 2)).toBe(59);
    expect(trayRoom(true, 3)).toBe(68);
    expect(armedRoom(2, true, 1, 1)).toBe(armedRoom(2, true));
    expect(armedRoom(2, true, 1, 2)).toBe(2 * 18 * 2 + 4);
  });

  it("fits a plain moment (Pass, Cancel, an attack readout, one row) in the real column at the default text size and at 1.5, on 844x390 and 667x375", () => {
    for (const size of SIZES) {
      expect(fitAt({ size, s: UI_SCALES.medium, text: 1, content: PLAIN, folded: false }).used, `${size.height} tall, text 1`).toBeLessThanOrEqual(dockColumn(size.height, 1, NO_INSETS));
    }
    const wide = fitAt({ size: SIZES[0], s: UI_SCALES.medium, text: 1.5, content: PLAIN, folded: false });
    expect(wide.used).toBeLessThanOrEqual(wide.column);
  });

  // Known gap (ACCESSIBILITY.md, Known gaps): at font scale 2 the primary "Leave undefended" wraps to three lines in the 168 pt words and
  // "Cancel" and More take two rows, so with the title and one row the controls alone pass the column. Nothing may be cut to fit, so this stays
  // an expected failure until the dock has a way to hold it; it turns red the day it passes.
  it.fails("keeps the audit's worst moment inside the column at Medium and font scale 2, on 844x390 and 667x375", () => {
    for (const size of SIZES) {
      const at = fitAt({ size, s: UI_SCALES.medium, text: 2, content: WORST, folded: true });
      expect(at.used, `${size.height} tall`).toBeLessThanOrEqual(at.column);
    }
  });

  it("never folds the aids at the default text size, at any UI scale, screen height or moment", () => {
    for (const size of SIZES) {
      for (const s of Object.values(UI_SCALES)) {
        for (const content of [WORST, PLAIN]) {
          for (const trayOpen of [true, false]) expect(foldAids(foldArgs(size, s, 1, content, trayOpen)), `${size.height} tall, scale ${s}`).toBe(false);
        }
      }
    }
    expect(foldAids(foldArgs(SIZES[1], 1, 0.85, WORST, true))).toBe(false);
  });

  it("folds the aids behind More above the default text size when three of them wrap to a second row and folding takes that row back", () => {
    const three = moment({ primary: "Pass", readout: ATTACK });
    const args = { ...foldArgs(SIZES[1], 1, 2, three, true), extras: [UNDO, READ, { label: "List", testID: "sheet-list", onPress: () => {} }] };
    expect(foldAids(args)).toBe(true);
    // A tall screen has the room; no row open takes less.
    expect(foldAids({ ...args, height: 844 })).toBe(false);
    // Folding that saves nothing is not done: More wraps to a row of its own beside a full answers row.
    expect(foldAids(foldArgs(SIZES[1], 1, 2, PLAIN, true))).toBe(false);
  });
});

function foldArgs(size: (typeof SIZES)[number], s: number, text: number, content: DockContent, trayOpen: boolean) {
  return { height: size.height, s, text, insets: NO_INSETS, width: widthAt(size.width, s), trayOpen, dock: content.dock, readout: content.readout, refusal: content.refusal, extras: [UNDO, READ] };
}

describe("the line caps", () => {
  it("keeps a cap at the phone's default text size and lifts it above", () => {
    expect(capLines(2, 1)).toBe(2);
    expect(capLines(3, 0.85)).toBe(3);
    expect(capLines(2, 1.15)).toBeUndefined();
    expect(capLines(1, 2)).toBeUndefined();
  });
});
