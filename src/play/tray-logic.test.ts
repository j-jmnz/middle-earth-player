import { describe, expect, it } from "vitest";

import { openReading, type Reading } from "./reading.ts";
import type { MultiSheet, PickSheet, TriggerSheet } from "./sheet-types.ts";
import type { Choice } from "./table-choice.ts";
import { cardSize, encounterPiles } from "./layout.ts";
import { outsideLayers, reachInto, tapRoute, TRAY_MAX, TRAY_REACH, trayBox, trayCount, trayOpen, trayTiles } from "./tray-logic.ts";

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
    expect(trayCount(multi, choice("commit", ["a", "b"]))).toBe("Commit · 2 of 4 picked");
    expect(trayCount(pick, choice("defense:1", []))).toBe("Defend · pick 1 of 3");
    expect(trayCount(pick, choice("defense:1", ["a"]))).toBe("Defend · 1 of 3 picked");
  });
});

describe("the outside tap", () => {
  it("folds an open tray and goes no further: no pick, no pile, no intent", () => {
    expect(tapRoute({ panelOpen: true, reader: false, cardId: "c1" })).toBe("fold");
    expect(tapRoute({ panelOpen: true, reader: false, cardId: "pile:discard" })).toBe("fold");
  });

  it("routes normally with a screen reader on or no tray open", () => {
    expect(tapRoute({ panelOpen: true, reader: true, cardId: "c1" })).toBe("pick");
    expect(tapRoute({ panelOpen: true, reader: true, cardId: "pile:discard" })).toBe("pile");
    expect(tapRoute({ panelOpen: false, reader: false, cardId: "c1" })).toBe("pick");
    expect(tapRoute({ panelOpen: false, reader: false, cardId: "pile:deck" })).toBe("pile");
  });

  it("mounts the hit layers only while the tray shows and nothing else reads or listens", () => {
    expect(outsideLayers({ trayShown: true, reading: false, reader: false })).toBe(true);
    expect(outsideLayers({ trayShown: false, reading: false, reader: false })).toBe(false);
    expect(outsideLayers({ trayShown: true, reading: true, reader: false })).toBe(false);
    expect(outsideLayers({ trayShown: true, reading: false, reader: true })).toBe(false);
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
  const phone = (width: number, height: number, anchorTop: number, insetRight = 0) => {
    const commandWidth = Math.round(Math.min(280, Math.max(210, width * 0.3)));
    const canvas = width - insetRight * 2 - commandWidth;
    const pileGap = encounterPiles(canvas, height - 44).gap;
    return { commandWidth, box: trayBox({ commandWidth, insetRight, screenWidth: width, screenHeight: height, barBottom: 44, anchorTop, pileGap }) };
  };

  it("is the command column's width at 844, because the encounter discard stands 8 pt from the canvas's edge: the reach is clamped to 0", () => {
    expect(phone(844, 390, 200).commandWidth).toBe(253);
    expect(phone(844, 390, 200).box).toMatchObject({ width: 253, overlap: 0 });
    expect(phone(844, 390, 200, 47).box.overlap).toBe(0);
    const wide = phone(1100, 500, 300);
    expect(wide.commandWidth).toBe(280);
    expect(wide.box.width).toBeLessThanOrEqual(TRAY_MAX);
    expect(wide.box.overlap).toBe(0);
  });

  it("clamps the reach to PILE_CLEAR short of the rightmost pile, never past TRAY_REACH, and 0 under WIDE", () => {
    expect(reachInto(844, 8)).toBe(0);
    expect(reachInto(844, 30)).toBe(22);
    expect(reachInto(844, 200)).toBe(TRAY_REACH);
    expect(reachInto(667, 200)).toBe(0);
  });

  it("covers neither encounter pile with the tray open, at 844x390 and 667x375, notch or not", () => {
    for (const [width, height] of [[844, 390], [667, 375]] as const) {
      for (const inset of [0, 47]) {
        const { box, commandWidth } = phone(width, height, 200, inset);
        const canvas = width - 2 * inset - commandWidth;
        const piles = encounterPiles(canvas, height - 44).rects;
        const trayLeft = canvas + commandWidth - box.width;
        for (const rect of [piles.encounterDeck, piles.encounterDiscard]) expect(rect.x + rect.w, `${width} inset ${inset}`).toBeLessThanOrEqual(trayLeft);
      }
    }
  });

  it("is why the reach gives way: reserving it (+8 pt) in the canvas's right gutter shrinks the cards on a notched 844 (56 to 52), and costs nothing only without insets", () => {
    const at = (width: number, height: number, inset: number, reserve: number) => cardSize(width - 2 * inset - Math.round(Math.min(280, Math.max(210, width * 0.3))) - reserve, height - 44).w;
    expect(at(844, 390, 0, 0)).toBe(56);
    expect(at(844, 390, 0, TRAY_REACH + 8)).toBe(56);
    expect(at(844, 390, 47, 0)).toBe(56);
    expect(at(844, 390, 47, TRAY_REACH + 8)).toBe(52);
  });

  it("reaches no further than the command column under 720 pt wide", () => {
    expect(phone(667, 375, 200).commandWidth).toBe(210);
    expect(phone(667, 375, 200).box).toMatchObject({ width: 210, overlap: 0 });
  });

  it("ends above the dock's block and rises no higher than the top bar", () => {
    const { box } = phone(844, 390, 210, 47);
    expect(390 - box.bottom).toBe(206);
    expect(box.maxHeight + 44 + box.bottom).toBe(390);
    expect(box.right).toBe(47);
  });

  it("is never less than a minimum tall, even when the dock leaves no room", () => {
    expect(phone(844, 390, 46).box.maxHeight).toBeGreaterThanOrEqual(72);
    expect(phone(844, 390, 100).box.maxHeight).toBeGreaterThanOrEqual(72);
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
