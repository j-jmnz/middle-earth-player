// The pure budget modules at a UI scale (docs/plans/done/settings-theme-and-ui-scale.md, UI scale engine; user request, 2026-10-28): at scale 1
// they are what they were; at Large, a screen 1.15 times as large gives 1.15 times the answer, since they work in logical points.
import { describe, expect, it } from "vitest";

import { armedRoom } from "./armed-room.ts";
import { isDense, labelChars, linesPlace, planWords, titleLinesOf, wordsWindow } from "./dock-budget.ts";
import { previewSideSize, previewSize } from "./preview-size.ts";
import { stageOf } from "./spotlight-stage.ts";
import { barZones, MENU_BUTTON, railWide, RAIL_WIDE } from "./top-bar-layout.ts";
import { trayBox } from "./tray-logic.ts";
import { UI_SCALES } from "./ui-scale.ts";

const L = UI_SCALES.large;
const S = UI_SCALES.small;

describe("scale 1 is unchanged and 1.15 is proportional", () => {
  it("top bar zones", () => {
    for (const [bar, dials] of [[800, 120], [800, 400], [620, 460], [500, 900]] as const) {
      expect(barZones(bar, dials, 1)).toEqual(barZones(bar, dials));
      const a = barZones(bar, dials);
      const b = barZones(bar * L, dials * L, L);
      expect(b.left).toBeCloseTo(a.left * L, 6);
      expect(b.rail).toBeCloseTo(a.rail * L, 6);
      expect(b.right).toBeCloseTo(a.right * L, 6);
      expect(b.scroll).toBe(a.scroll);
    }
    expect(railWide(RAIL_WIDE * L, false, L)).toBe(true);
    expect(railWide(RAIL_WIDE * L - 1, false, L)).toBe(false);
  });

  it("keeps the menu button's 44 pt at Small", () => {
    const zones = barZones(800, 0, S);
    expect(zones.right).toBeGreaterThanOrEqual(MENU_BUTTON);
  });

  it("dock budget", () => {
    expect(wordsWindow({ room: 300, block: 200 }, 1)).toBe(wordsWindow({ room: 300, block: 200 }));
    expect(wordsWindow({ room: 300 * L, block: 200 * L, dense: true }, L)).toBeCloseTo(wordsWindow({ room: 300, block: 200, dense: true }) * L, 6);
    expect(titleLinesOf("A long title for a card name", 168 * L, L)).toBe(titleLinesOf("A long title for a card name", 168));
    expect(labelChars(168 * L, L)).toBe(labelChars(168));
    const plan = { space: 60, dense: true, title: "Choose a defender for Gollum, Guide of the Dead Marshes", textWidth: 168, hasLine: true, foldable: true };
    expect(planWords({ ...plan, space: plan.space * L, textWidth: plan.textWidth * L }, L)).toEqual(planWords(plan));
    const place = { screenWidth: 844, screenHeight: 390, commandWidth: 253, insetLeft: 0, insetRight: 0, top: 100 };
    const a = linesPlace(place);
    const b = linesPlace({ ...place, screenWidth: 844 * L, screenHeight: 390 * L, commandWidth: 253 * L, top: 100 * L }, L);
    expect(b.maxHeight).toBeCloseTo(a.maxHeight * L, 6);
    expect(b.width).toBeCloseTo(a.width * L, 6);
  });

  it("the dense line is the logical height", () => {
    expect(isDense(399)).toBe(true);
    expect(isDense(400)).toBe(false);
    expect(isDense(400 * L, L)).toBe(false);
    expect(isDense(399 * L, L)).toBe(true);
    // A 460 pt phone is dense at Large (400 logical points of 460 / 1.15) and not at Small.
    expect(isDense(460, L)).toBe(false);
    expect(isDense(430, L)).toBe(true);
    expect(isDense(430, S)).toBe(false);
  });

  it("armed room, tray, preview and spotlight stage", () => {
    expect(armedRoom(3, false, 1)).toBe(armedRoom(3, false));
    expect(armedRoom(3, true, L)).toBeCloseTo(armedRoom(3, true) * L, 9);
    const tray = { commandWidth: 253, insetRight: 0, screenHeight: 390, barBottom: 52, anchorTop: 200 };
    expect(trayBox(tray, 1)).toEqual(trayBox(tray));
    expect(trayBox({ ...tray, commandWidth: 253 * L }, L).width).toBeCloseTo((253 - 16) * L, 6);
    expect(previewSize(390, 700, false, 1)).toEqual(previewSize(390, 700, false));
    const p = previewSideSize(800, 360, true);
    const q = previewSideSize(800 * L, 360 * L, true, L);
    expect(Math.abs(q.width - p.width * L)).toBeLessThanOrEqual(1);
    const area = (k: number) => ({ width: 800 * k, height: 360 * k, origin: { x: 40 * k, y: 50 * k }, safe: { top: 10 * k, right: 40 * k, bottom: 20 * k, left: 40 * k } });
    const stage = stageOf(area(1), { w: 50, h: 70 }, 2, true);
    const big = stageOf(area(L), { w: 50 * L, h: 70 * L }, 2, true, L);
    expect(big.target.w).toBeCloseTo(stage.target.w * L, 6);
    expect(big.target.x).toBeCloseTo(stage.target.x * L, 6);
    expect(big.contact.y).toBeCloseTo(stage.contact.y * L, 6);
    expect(big.gap).toBeCloseTo(stage.gap * L, 6);
    expect(big.note.cy).toBeCloseTo(stage.note.cy * L, 6);
    expect(big.radius).toBeCloseTo(stage.radius * L, 6);
  });
});
