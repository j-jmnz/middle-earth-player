// Rules: dcce.island-map, dcce.exploration, dcce.uncharted (data/rules/entries.json). The Island Map on the phone table (docs/design-system-table.md, The Island Map): the readout the chip and the panel are drawn from, the words
// a screen reader says, that nothing says what lies on a facedown side, and the panel's geometry on every screen down to 667 x 375 at the three UI scales.
import { beforeAll, describe, expect, it } from "vitest";

import { CODES, loadTempleWorld, templeTable, type TempleLayout, type TempleWorld } from "../../../test/scenarios/temple-of-the-deceived/scene.ts";
import { trayBox } from "../choice/tray-logic.ts";
import { CHIP, COLS, LEGEND, ROWS, TEMPLE_LABEL_WORD, TEMPLE_NAME, WAITING, chipHeight, chipWidth, chipWords, islandFit, islandPanelWidth, islandReadout, standingWords, tileMarks } from "./island-table.ts";
import { LOST_ISLAND_NAME } from "../words/scenarios/uncharted.ts";
import { UI_SCALES, touch } from "../../ui/ui-scale.ts";

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
    // Flipped over but never left: revealed, not explored (dcce.exploration: a location is explored when the players travel from it).
    expect(readout.cells.map((cell) => cell.state).filter((state) => state === "revealed")).toHaveLength(3);
    expect(readout.cells.filter((cell) => cell.state === "explored")).toHaveLength(0);
    expect(readout.covered).toBe(11);
    expect(readout.explored).toBe(0);
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
    expect(flipped.readout.cells[7]).toMatchObject({ state: "revealed", name: "Jagged Cliffs", points: 4 });
  });

  it("calls a location the players traveled from explored, and counts it in the header", () => {
    const { readout } = readoutOf({ explored: [0, 10] });
    expect(readout.cells.filter((cell) => cell.state === "explored").map((cell) => [cell.row, cell.col])).toEqual([[0, 0], [2, 0]]);
    expect(readout.cells[1]).toMatchObject({ state: "revealed" });
    expect(readout.explored).toBe(2);
    expect(readout.cells[0]?.words).toContain("explored");
    expect(readout.cells[1]?.words).toContain("revealed, not explored");
  });

  it("shows the marker on the active location and its progress against its quest points", () => {
    const { readout } = readoutOf({ cellProgress: [[6, 2]] });
    expect(readout.active).toMatchObject({ progress: 2, points: world.cards.get(CODES.cursedTemple)?.questPoints });
    expect(readout.mayTravel).toBe(false);
    expect(standingWords(readout)).toMatch(/The marker is on Cursed Temple \(row 2, column 2\)\. It needs \d+ more progress before the players can travel from it\. The Temple is 3 columns to the right\./);
    const full = readoutOf({ cellProgress: [[6, world.cards.get(CODES.cursedTemple)?.questPoints ?? 0]] });
    expect(full.readout.mayTravel).toBe(true);
    expect(standingWords(full.readout)).toMatch(/It is full: the players may travel from it\./);
  });

  it("says how far the Temple column lies, and when the marker is in it", () => {
    expect(standingWords(readoutOf({ at: 8 }).readout)).toContain("The Temple is 1 column to the right.");
    expect(standingWords(readoutOf({ at: 9 }).readout)).toContain("The marker is in the Temple column.");
  });

  it("marks the tiles: ? over a covered one, the marker over the progress of the active one, a check over the quest points of an explored one with none", () => {
    const { readout } = readoutOf({ cellProgress: [[6, 2], [10, 1]], explored: [0, 10] });
    const points = world.cards.get(CODES.cursedTemple)?.questPoints ?? 0;
    expect(tileMarks(readout.cells[2]!)).toEqual(["?", null]);
    expect(tileMarks(readout.cells[6]!)).toEqual(["\u25CF", `2/${points}`]);
    expect(tileMarks(readout.cells[0]!)).toEqual(["\u2713", String(readout.cells[0]?.points)]);
    expect(tileMarks(readout.cells[10]!)).toEqual([`1/${readout.cells[10]?.points}`, null]);
    expect(tileMarks(readout.cells[1]!)).toEqual([`0/${readout.cells[1]?.points}`, null]);
  });

  it("names the Temple column in the legend and over the column", () => {
    expect(TEMPLE_LABEL_WORD).toBe("Temple");
    expect(LEGEND.map((item) => item.word)).toEqual(["Active", "In staging", "Explored", "Revealed", "Not explored"]);
  });

  it("marks a Temple location that a secret lies under, without saying what it is", () => {
    const { readout } = readoutOf({ secrets: ["", CODES.starla, CODES.nightmare], campaign: true });
    expect(readout.cells.filter((cell) => cell.secret).map((cell) => [cell.row, cell.col])).toEqual([[1, 4], [2, 4]]);
    for (const cell of readout.cells.filter((cell) => cell.secret)) expect(cell.words).toContain("a secret lies under it");
    expect(JSON.stringify(readout)).not.toMatch(/Starla|Nightmare/);
  });

  it("says the chip's words: the map, where the marker stands and how many locations are in staging", () => {
    const { readout } = readoutOf();
    expect(chipWords(readout)).toBe("Island Map, active: row 2, column 2, Cursed Temple, 4 locations in staging, 0 of 15 explored, the players may not travel yet");
    const edge = readoutOf({ at: 0, explored: [10], cellProgress: [[0, world.cards.get("12072")?.questPoints ?? 0]] });
    // Jagged Cliffs is the active location: the one to its right is shut out of the staging area, so one is left (below it).
    expect(chipWords(edge.readout)).toBe("Island Map, active: row 1, column 1, Jagged Cliffs, 1 location in staging, 1 of 15 explored, the players may travel");
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

// The panel's room as table-layers.tsx leaves it: the map's width (wider than the reading frame, within the screen), and the height under the top bar above the foot and the edge, less the "Choice waiting" line while a choice is open.
function room(screen: Screen, scale: number, waiting: boolean): { width: number; maxHeight: number } {
  const command = Math.round(Math.min(280, Math.max(210, (screen.width / scale) * 0.3)) * scale);
  const barBottom = (8 + 52) * scale;
  const box = trayBox({ commandWidth: command, insetRight: screen.inset.right, screenHeight: screen.height, barBottom, anchorTop: Math.round(screen.height * 0.55) }, scale);
  const foot = Math.max(screen.inset.bottom, EDGE * scale);
  const frame = Math.max(READING_MIN * scale, box.width);
  return { width: islandPanelWidth(frame, screen.width - screen.inset.left - screen.inset.right - 2 * EDGE * scale, scale), maxHeight: screen.height - barBottom - foot - EDGE * scale - (waiting ? WAITING * scale : 0) };
}

describe("the panel's geometry", () => {
  // The longest sentence under the grid: a marker that is not full, with a Temple column to the right (read once the world is loaded).
  const standingText = () => standingWords(readoutOf({ cellProgress: [[6, 1]] }).readout);
  for (const screen of SCREENS) {
    for (const [name, scale] of Object.entries(UI_SCALES)) {
      for (const waiting of [false, true]) {
        it(`fits its three rows and its words under the top bar on ${screen.name} at ${name}${waiting ? " with a choice waiting" : ""}, every tile a thumb wide and tall and the panel inside the screen`, () => {
          const { width, maxHeight } = room(screen, scale, waiting);
          const fit = islandFit(width, maxHeight, scale, standingText());
          // Extra large on a phone cannot hold the header, the grid and the words in the room under the bar: the tiles keep their thumb size, the words stand
          // beside the grid, and the panel's scroll carries what does not fit (`fits` false). Every other scale fits whole.
          if (name !== "xlarge") expect(fit.fits, `${screen.name} ${name}: ${JSON.stringify(fit)}`).toBe(true);
          expect(fit.tileW).toBeGreaterThanOrEqual(touch(scale, 44));
          expect(fit.tileH).toBeGreaterThanOrEqual(touch(scale, 44));
          expect(fit.gridW).toBeLessThanOrEqual(width);
          expect(fit.gridH).toBeLessThan(maxHeight);
          expect(width).toBeLessThanOrEqual(screen.width - screen.inset.left - screen.inset.right - 2 * EDGE * scale);
          expect(width).toBeGreaterThanOrEqual(READING_MIN * scale);
          // Nothing is below the fold at the other scales. At Extra large the words stand beside the grid when the grid fits under the header; with a choice
          // waiting on a short phone not even the grid does, and the panel's scroll carries it, its tiles still a thumb in both directions.
          const scrolls = name === "xlarge" && waiting;
          if (name !== "xlarge") expect(fit.layout).toBe("beside");
          expect(fit.gridW + (fit.layout === "beside" ? fit.textW : 0)).toBeLessThanOrEqual(width);
          if (!scrolls) expect((18 + 24 + 4) * scale + fit.gridH + 17 * scale).toBeLessThanOrEqual(maxHeight + 0.5);
        });
      }
    }
  }

  it("keeps every tile a thumb in both directions even when the words go under the grid (a narrow panel), and says when the room is too short", () => {
    const standing = standingText();
    const stacked = islandFit(330, 520, 1, standing);
    expect(stacked.layout).toBe("below");
    expect(stacked.tileW).toBeGreaterThanOrEqual(44);
    expect(stacked.tileH).toBeGreaterThanOrEqual(44);
    expect(stacked.fits).toBe(true);
    expect(islandFit(330, 300, 1, standing).fits).toBe(false);
    expect(islandFit(320, 120, 1).fits).toBe(false);
  });

  it("shrinks the tiles before it cuts the grid when the room is short", () => {
    const standing = standingText();
    const roomy = islandFit(330, 520, 1, standing);
    const tight = islandFit(330, 430, 1, standing);
    expect(tight.tileH).toBeLessThan(roomy.tileH);
    expect(tight.gridW).toBe(roomy.gridW);
  });
});
