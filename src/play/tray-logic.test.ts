import { describe, expect, it } from "vitest";

import { openReading, type Reading } from "./reading.ts";
import type { MultiSheet, PickSheet, TriggerSheet } from "./sheet-types.ts";
import type { Choice } from "./table-choice.ts";
import { outsideTap, TRAY_MAX, TRAY_REACH, trayBox, trayCount, trayOpen, trayTiles } from "./tray-logic.ts";

// The choice tray (docs/design-system.md, Table; phase 21): its tiles, its count, what a tap outside it does, and where it sits
// against the command column and the dock. No rule is implemented here.
const damage = { icon: "damage" as const, value: 2, danger: false };
const pick: PickSheet = {
  kind: "pick",
  key: "defense:1",
  step: "Combat",
  title: "Defend",
  note: null,
  verb: "Defend with",
  options: [
    { id: "a", label: "Aragorn", code: "01001", stats: [{ icon: "defense", value: 2, word: "Defense" }], mark: damage, intent: { type: "Undefended", heroId: "a" } },
    { id: "b", label: "Sam", code: "01002", mark: { icon: "damage", value: 3, danger: true }, intent: { type: "Undefended", heroId: "b" } },
    { id: "c", label: "Take it", code: null, intent: { type: "Pass" } },
  ],
  unavailable: [{ id: "d", label: "Frodo", code: "01003", reason: "exhausted" }],
  primary: null,
  alternative: null,
};
const multi: MultiSheet = {
  kind: "multi",
  key: "commit",
  step: "Quest",
  title: "Commit",
  note: null,
  verb: "Commit",
  options: ["a", "b", "c", "d"].map((id) => ({ id, label: id, code: null })),
  build: { kind: "Commit" },
  allowEmpty: true,
  preselected: [],
  alternative: null,
};
const choice = (key: string, ids: string[]): Choice => ({ key, ids, shares: [] });

describe("tray tiles and count", () => {
  it("makes one tile per option with its card, its stats and its foreseen damage, and a long press only on a card", () => {
    const tiles = trayTiles(pick);
    expect(tiles.map((tile) => tile.id)).toEqual(["a", "b", "c"]);
    expect(tiles[0]).toMatchObject({ code: "01001", readId: "a", mark: damage });
    expect(tiles[0]?.stats).toHaveLength(1);
    expect(tiles[1]?.mark?.danger).toBe(true);
    expect(tiles[2]).toMatchObject({ code: null, readId: null, mark: null });
  });

  it("names a trigger by its ability and reads its source card", () => {
    const trigger = {
      kind: "trigger",
      key: "t",
      step: "Response",
      title: "Respond",
      sourceId: null,
      timing: "Response",
      note: null,
      hide: null,
      pass: "Pass",
      options: [{ id: "c1|e1", label: "Gandalf", code: "01073", effectId: "e1", cardId: "c1", timing: "Response", text: "Draw 3 cards.", pay: null }],
    } satisfies TriggerSheet;
    expect(trayTiles(trigger)).toEqual([expect.objectContaining({ label: "Gandalf · Response", detail: "Draw 3 cards.", readId: "c1" })]);
  });

  it("counts the picks in words and holds nothing for a window", () => {
    expect(trayCount(multi, choice("commit", ["a", "b"]))).toBe("2 of 4 picked");
    expect(trayCount(pick, choice("defense:1", []))).toBe("Pick one of 3");
    expect(trayCount(pick, choice("defense:1", ["a"]))).toBe("1 picked");
  });
});

describe("the outside tap", () => {
  it("folds an open tray and is not routed on, so it picks nothing and sends no intent", () => {
    expect(outsideTap({ panelOpen: true, reader: false })).toBe("fold");
  });

  it("does not fold while a screen reader is on, or when no tray is open", () => {
    expect(outsideTap({ panelOpen: true, reader: true })).toBe("route");
    expect(outsideTap({ panelOpen: false, reader: false })).toBe("route");
  });

  it("is folded by key: Choose brings the same sheet back, and a new moment opens unfolded", () => {
    let folded: string | null = null;
    expect(trayOpen(true, folded, "defense:1")).toBe(true);
    folded = "defense:1";
    expect(trayOpen(true, folded, "defense:1")).toBe(false);
    // The dock's Choose clears the fold.
    folded = null;
    expect(trayOpen(true, folded, "defense:1")).toBe(true);
    // Folded for one sheet, a next moment's sheet is open.
    folded = "defense:1";
    expect(trayOpen(true, folded, "defense:2")).toBe(true);
    // A choice answered on the table has no tray at all.
    expect(trayOpen(false, null, "x")).toBe(false);
  });
});

describe("where the tray sits", () => {
  const phone = (width: number, height: number, anchorTop: number | null, insetRight = 0) => {
    const commandWidth = Math.round(Math.min(280, Math.max(210, width * 0.3)));
    return { commandWidth, box: trayBox({ commandWidth, insetRight, screenHeight: height, barBottom: 44, anchorTop }) };
  };

  it("is the command column's width plus up to 40 pt into the canvas, at most 340", () => {
    expect(phone(844, 390, 200).commandWidth).toBe(253);
    expect(phone(844, 390, 200).box).toMatchObject({ width: 293, overlap: TRAY_REACH });
    expect(phone(667, 375, 200).commandWidth).toBe(210);
    expect(phone(667, 375, 200).box).toMatchObject({ width: 250, overlap: TRAY_REACH });
    const wide = phone(1100, 500, 300);
    expect(wide.commandWidth).toBe(280);
    expect(wide.box?.width).toBeLessThanOrEqual(TRAY_MAX);
  });

  it("ends above the dock's block and rises no higher than the top bar", () => {
    const { box } = phone(844, 390, 210, 47);
    expect(box).not.toBeNull();
    // The foot is above the anchor; the top is under the bar.
    expect(390 - (box?.bottom ?? 0)).toBeLessThan(210);
    expect((box?.maxHeight ?? 0) + 44 + (box?.bottom ?? 0)).toBeLessThanOrEqual(390);
    expect(box?.right).toBe(47);
  });

  it("waits for the dock to be measured, and for room", () => {
    expect(phone(844, 390, null).box).toBeNull();
    expect(phone(844, 390, 46).box).toBeNull();
  });
});

describe("the reading layer", () => {
  const log: Reading = { kind: "log" };
  it("replaces the last one, whatever it was", () => {
    expect(openReading({ kind: "threat", seat: 0 }, { kind: "carousel" })).toEqual({ kind: "carousel" });
    expect(openReading({ kind: "carousel" }, log)).toEqual(log);
    expect(openReading(log, { kind: "pile", pile: "discard" })).toEqual({ kind: "pile", pile: "discard" });
    expect(openReading(null, { kind: "settings" })).toEqual({ kind: "settings" });
  });

  it("closes the carousel on a second tap of the rail", () => {
    expect(openReading({ kind: "carousel" }, { kind: "carousel" })).toBeNull();
  });
});
