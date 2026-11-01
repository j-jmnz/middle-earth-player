// Rules: dcce.island-map, dcce.exploration, dcce.uncharted (data/rules/entries.json). The Island Map on the phone table (docs/design-system-table.md, The Island Map): the readout the chip and the panel are drawn from, the words
// a screen reader says, that nothing says what lies on a facedown side, and the panel's geometry on every screen down to 667 x 375 at the three UI scales.
import { beforeAll, describe, expect, it } from "vitest";

import { CODES, loadTempleWorld, templeTable, type TempleLayout, type TempleWorld } from "../../scripts/temple-scene.ts";
import { trayBox } from "./tray-logic.ts";
import { CHIP, COLS, ROWS, TEMPLE_NAME, chipHeight, chipWidth, chipWords, islandFit, islandReadout, standingWords } from "./island-table.ts";
import { LOST_ISLAND_NAME } from "./uncharted-words.ts";
import { UI_SCALES, touch } from "./ui-scale.ts";

let world: TempleWorld;

beforeAll(async () => {
  world = await loadTempleWorld();
});

// Row by row; the Temple column is the last. Index 6 is row 1, column 1.
const MAP = [
  "12072", "12073", "?12074", "?11072", "?12068",
  "?11073", "11074", "?12072", "?12073", "?12069",
  "12074", "?11072", "?11073", "?11074", "?12069",
] as const;

const readoutOf = (layout: TempleLayout = {}) => {
  const made = templeTable(world, { map: MAP, at: 6, phase: "Travel", ...layout });
  return { made, readout: islandReadout(made.state, made.ctx.cards)! };
};

describe("the Island Map readout", () => {
  it("is null in a game with no map", () => {
    const made = templeTable(world, {});
    expect(islandReadout(made.state, made.ctx.cards)).toBeNull();
  });

  it("lists the fifteen cells row by row, three rows of five, with the active one, the ones next to it and the Temple column", () => {
    const { readout } = readoutOf();
    expect(readout.cells).toHaveLength(15);
    expect(readout.cells.map((cell) => [cell.row, cell.col]).slice(0, 6)).toEqual([[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 0]]);
    expect(readout.active).toMatchObject({ row: 1, col: 1, state: "active", name: "Cursed Temple" });
    expect(readout.cells.filter((cell) => cell.next).map((cell) => [cell.row, cell.col])).toEqual([[0, 1], [1, 0], [1, 2], [2, 1]]);
    expect(readout.staging).toBe(4);
    expect(readout.cells.filter((cell) => cell.temple).map((cell) => cell.col)).toEqual([4, 4, 4]);
    expect(readout.cells.map((cell) => cell.state).filter((state) => state === "explored")).toHaveLength(3);
    expect(readout.covered).toBe(11);
  });

  it("says nothing of what lies on the facedown side of a covered location: a Lost Island, or in the Temple column Temple of the Deceived", () => {
    const { readout } = readoutOf();
    const covered = readout.cells.filter((cell) => cell.state === "covered");
    expect(covered).toHaveLength(11);
    for (const cell of covered) {
      expect(cell.name, cell.id).toBe(cell.temple ? TEMPLE_NAME : LOST_ISLAND_NAME);
      expect(cell.points, cell.id).toBeNull();
      // No word a screen reader says names a card's real side.
      expect(cell.words, cell.id).not.toMatch(/Halls|Grotto|Cliffs|Caverns|Jungle|Ruins|Graves|Cursed/);
    }
    // The same location, flipped over, says what it is.
    const flipped = readoutOf({ map: MAP.map((code, at) => (at === 7 ? "12072" : code)) });
    expect(flipped.readout.cells[7]).toMatchObject({ state: "explored", name: "Jagged Cliffs", points: 4 });
  });

  it("shows the marker on the active location and its progress against its quest points", () => {
    const { readout } = readoutOf({ cellProgress: [[6, 2]] });
    expect(readout.active).toMatchObject({ progress: 2, points: world.cards.get(CODES.cursedTemple)?.questPoints });
    expect(readout.mayTravel).toBe(false);
    expect(standingWords(readout)).toMatch(/The marker is on Cursed Temple \(row 2, column 2\)\. It needs \d+ more progress before the players can travel from it\./);
    const full = readoutOf({ cellProgress: [[6, world.cards.get(CODES.cursedTemple)?.questPoints ?? 0]] });
    expect(full.readout.mayTravel).toBe(true);
    expect(standingWords(full.readout)).toMatch(/It is full: the players may travel from it\./);
  });

  it("marks a Temple location that a secret lies under, without saying what it is", () => {
    const { readout } = readoutOf({ secrets: ["", CODES.starla, CODES.nightmare], campaign: true });
    expect(readout.cells.filter((cell) => cell.secret).map((cell) => [cell.row, cell.col])).toEqual([[1, 4], [2, 4]]);
    for (const cell of readout.cells.filter((cell) => cell.secret)) expect(cell.words).toContain("a secret lies under it");
    expect(JSON.stringify(readout)).not.toMatch(/Starla|Nightmare/);
  });

  it("says the chip's words: the map, where the marker stands and how many locations are in staging", () => {
    const { readout } = readoutOf();
    expect(chipWords(readout)).toBe("Island Map, active: row 2, column 2, Cursed Temple, 4 locations in staging");
    const edge = readoutOf({ at: 0 });
    // Jagged Cliffs is the active location: the one to its right is shut out of the staging area, so one is left (below it).
    expect(chipWords(edge.readout)).toBe("Island Map, active: row 1, column 1, Jagged Cliffs, 1 location in staging");
  });

  it("follows the staging area when a location shuts a neighbor out (Jagged Cliffs, 12072:A:1)", () => {
    const { readout } = readoutOf({ at: 7, map: MAP.map((code, at) => (at === 7 ? "12072" : code)) });
    expect(readout.cells.filter((cell) => cell.next).map((cell) => [cell.row, cell.col])).toEqual([[0, 2], [1, 1], [2, 2]]);
  });
});

describe("the chip", () => {
  it("is a 5 x 3 grid of small cells inside a target a thumb can press", () => {
    expect(COLS).toBe(5);
    expect(ROWS).toBe(3);
    expect(chipWidth()).toBe(5 * CHIP.cell + 4 * CHIP.gap + 2 * CHIP.pad);
    expect(chipHeight()).toBe(3 * CHIP.cell + 2 * CHIP.gap + 2 * CHIP.pad);
    // The press target is the 44 pt row the dials share (touch floor), whatever the scale.
    for (const scale of Object.values(UI_SCALES)) expect(touch(scale, 44)).toBeGreaterThanOrEqual(44);
    expect(chipHeight()).toBeLessThanOrEqual(44);
  });
});

type Screen = { width: number; height: number; inset: { left: number; right: number; bottom: number }; name: string };
const SCREENS: readonly Screen[] = [
  { name: "667 x 375", width: 667, height: 375, inset: { left: 0, right: 0, bottom: 0 } },
  { name: "844 x 390", width: 844, height: 390, inset: { left: 47, right: 47, bottom: 21 } },
];
const READING_MIN = 300;
const EDGE = 8;

// The panel's room as table-layers.tsx leaves it: the width of the reading frame, and the height under the top bar above the foot and the edge.
function room(screen: Screen, scale: number): { width: number; maxHeight: number } {
  const command = Math.round(Math.min(280, Math.max(210, (screen.width / scale) * 0.3)) * scale);
  const barBottom = (8 + 52) * scale;
  const box = trayBox({ commandWidth: command, insetRight: screen.inset.right, screenHeight: screen.height, barBottom, anchorTop: Math.round(screen.height * 0.55) }, scale);
  const foot = Math.max(screen.inset.bottom, EDGE * scale);
  return { width: Math.max(READING_MIN * scale, box.width), maxHeight: screen.height - barBottom - foot - EDGE * scale };
}

describe("the panel's geometry", () => {
  for (const screen of SCREENS) {
    for (const [name, scale] of Object.entries(UI_SCALES)) {
      it(`fits its three rows under the top bar on ${screen.name} at ${name}, every tile wide enough to press and the panel inside the screen`, () => {
        const { width, maxHeight } = room(screen, scale);
        const fit = islandFit(width, maxHeight, scale);
        expect(fit.fits, `${screen.name} ${name}: ${JSON.stringify(fit)}`).toBe(true);
        expect(fit.tileW).toBeGreaterThanOrEqual(touch(scale, 44) * 0.8);
        expect(fit.gridW).toBeLessThanOrEqual(width);
        expect(fit.gridH).toBeLessThan(maxHeight);
        expect(width).toBeLessThanOrEqual(screen.width - screen.inset.left - screen.inset.right - 2 * EDGE * scale);
        // Three rows fit with the panel's header and legend.
        expect(3 * fit.tileH + 2 * fit.gap).toBeLessThanOrEqual(maxHeight);
      });
    }
  }

  it("shrinks the tiles before it cuts the grid when the room is short, and says when even that does not fit", () => {
    const roomy = islandFit(320, 400, 1);
    const tight = islandFit(320, 240, 1);
    expect(tight.tileH).toBeLessThan(roomy.tileH);
    expect(tight.gridW).toBe(roomy.gridW);
    expect(islandFit(320, 120, 1).fits).toBe(false);
  });
});
