import { describe, expect, it } from "vitest";

import { openReading, type Reading } from "./reading.ts";
import type { MultiSheet, PickSheet, TriggerSheet } from "./sheet-types.ts";
import type { Choice } from "./table-choice.ts";
import { tableLayout } from "./layout.ts";
import { TOP_BAR } from "./top-bar-layout.ts";
import { PILES, TABLE_ZONES, type PileView, type ZoneId, type ZoneView } from "./selectors.ts";
import { COLUMN_PAD, listsResponses, outsideLayers, tapRoute, TRAY_MAX, trayBox, trayCount, trayOpen, trayTiles } from "./tray-logic.ts";

// The choice tray (docs/design-system-table.md; phase 21): its tiles, its count, what a tap outside it does, and where it sits
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

describe("a Response window", () => {
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
  it("opens listed whenever a Response can be used, and not for another window or an empty one", () => {
    expect(listsResponses(trigger, "response")).toBe(true);
    expect(listsResponses(trigger, "action")).toBe(false);
    expect(listsResponses({ ...trigger, options: [] }, "response")).toBe(false);
    expect(listsResponses(pick, "response")).toBe(false);
  });
  it("lets a tap on a listed Response's card pick it with the tray open, and folds for any other tap", () => {
    expect(tapRoute({ panelOpen: true, reader: false, cardId: "c1", answers: true })).toBe("pick");
    expect(tapRoute({ panelOpen: true, reader: false, cardId: "c2", answers: false })).toBe("fold");
    expect(tapRoute({ panelOpen: true, reader: false, cardId: "c1", answers: true, peeking: true })).toBe("fold");
  });
  it("leads the count with the Response's timing", () => {
    expect(trayCount(trigger, { key: "t", ids: [], shares: [] })).toBe("Response · pick 1 of 1");
    expect(trayCount(trigger, { key: "t", ids: ["c1|e1"], shares: [] })).toBe("Response · 1 of 1 picked");
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
    // Peeking at the other seat (phase 26): a card only previews, a pile still lists, the open tray still folds.
    expect(tapRoute({ panelOpen: false, reader: false, cardId: "c1", peeking: true })).toBe("preview");
    expect(tapRoute({ panelOpen: false, reader: false, cardId: "pile:discard", peeking: true })).toBe("pile");
    expect(tapRoute({ panelOpen: true, reader: false, cardId: "c1", peeking: true })).toBe("fold");
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
    return { commandWidth, box: trayBox({ commandWidth, insetRight, screenHeight: height, barBottom: TOP_BAR, anchorTop }) };
  };

  it("is the dock's width (the command column less its padding), at most 340", () => {
    expect(phone(844, 390, 200).commandWidth).toBe(253);
    expect(phone(844, 390, 200).box.width).toBe(253 - 2 * COLUMN_PAD);
    expect(phone(667, 375, 200).box.width).toBe(210 - 2 * COLUMN_PAD);
    const wide = phone(1100, 500, 300);
    expect(wide.commandWidth).toBe(280);
    expect(wide.box.width).toBeLessThanOrEqual(TRAY_MAX);
  });

  it("covers neither encounter pile with the tray open, at 844x390 and 667x375, with insets 0 and 47 (the canvas is the real layout)", () => {
    const views = Object.fromEntries(TABLE_ZONES.map((zone) => [zone, { zone, seat: 0, entries: [] } satisfies ZoneView])) as unknown as Record<ZoneId, ZoneView>;
    const piles = Object.fromEntries(PILES.map((pile) => [pile, { pile, seat: 0, ids: [], top: null } satisfies PileView])) as unknown as Record<(typeof PILES)[number], PileView>;
    for (const [width, height] of [[844, 390], [667, 375]] as const) {
      for (const inset of [0, 47]) {
        const { box, commandWidth } = phone(width, height, 200, inset);
        const canvas = width - 2 * inset - commandWidth;
        const layout = tableLayout(canvas, height - TOP_BAR, views, piles, {});
        // The canvas ends where the command column begins; the tray starts where the dock does, the column's padding inside it.
        const trayLeft = canvas + commandWidth - (box.right - inset) - box.width;
        expect(trayLeft, `${width} inset ${inset}`).toBe(canvas + COLUMN_PAD);
        for (const id of ["encounterDeck", "encounterDiscard"] as const) {
          const rect = layout.piles[id];
          expect(rect.x + rect.w, `${id} at ${width} inset ${inset}`).toBeLessThanOrEqual(trayLeft);
          expect(rect.x).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it("stands on the dock's block and rises no higher than the top bar", () => {
    const { box } = phone(844, 390, 210, 47);
    expect(390 - box.bottom).toBe(210);
    expect(box.maxHeight + TOP_BAR + box.bottom).toBe(390);
    expect(box.right).toBe(47 + COLUMN_PAD);
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
