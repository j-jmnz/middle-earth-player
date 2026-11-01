// Rules: dcce.island-map, dcce.exploration, dcce.uncharted (data/rules/entries.json). The Island Map as the table shows it (docs/design-system-table.md, The Island Map): a chip in the top bar and a reading panel, both drawn from
// one readout of the game. Pure, so a test reads it. Nothing here changes the game, and nothing here says what lies on the facedown side of a location: a location lying Uncharted side up is "Lost Island" (or, in the
// Temple column, "Temple of the Deceived") and nothing else, as the staging area and the card preview show it (shown-name.ts).
import { islandOf, TEMPLE_COLUMN, COLS, ROWS } from "../rules/families/island-map.ts";
import { islandMayTravel } from "../rules/families/island-travel.ts";
import { questPointsOf } from "../rules/quest.ts";
import type { PrintedCard } from "../rules/printed.ts";
import type { ScenarioState } from "../rules/state.ts";
import { cardsUnder } from "../rules/zones.ts";

import { LOST_ISLAND_NAME, TEMPLE_NAME } from "./uncharted-words.ts";
import { touch } from "./ui-scale.ts";

export { COLS, ROWS, TEMPLE_NAME };


/** How a location of the map is drawn: covered (Uncharted side up, its real side facedown), explored (flipped over, shows the location it is), or the active one, where the marker stands. */
export type IslandState = "covered" | "explored" | "active";

export type IslandCell = {
  id: string;
  row: number;
  col: number;
  state: IslandState;
  // Next to the active location, so in the staging area: the players may travel to it once the active location is full.
  next: boolean;
  // In the Temple column, whose locations cost the Gate Key to travel to while covered.
  temple: boolean;
  // A secret lies facedown under it (what it is, nobody knows until it is flipped).
  secret: boolean;
  name: string;
  progress: number;
  // The quest points of a location that shows its real side; null for a covered one (a Lost Island has none).
  points: number | null;
  // The words a screen reader says of the cell.
  words: string;
};

export type IslandReadout = {
  cells: readonly IslandCell[];
  active: IslandCell | null;
  // How many locations are in the staging area.
  staging: number;
  // The active location is full, so the players may travel from it.
  mayTravel: boolean;
  // How many locations still lie covered.
  covered: number;
};

function nameOf(game: ScenarioState, id: string, cards: ReadonlyMap<string, PrintedCard>, temple: boolean): string {
  const card = game.cards[id];
  const printed = card ? cards.get(card.code) : undefined;
  if (!card || !printed) return LOST_ISLAND_NAME;
  // Covered, a location is what its Uncharted side says it is; the card's code and name are not read (they are the facedown side's).
  if (card.face === "B") return temple ? TEMPLE_NAME : LOST_ISLAND_NAME;
  return printed.name;
}

const place = (row: number, col: number): string => `row ${row + 1}, column ${col + 1}`;
const progressWords = (progress: number, points: number | null): string => (points == null ? (progress > 0 ? `${progress} progress` : "") : `${progress} of ${points} progress`);

/** The map as the table draws it, or null in a game with no Island Map. */
export function islandReadout(game: ScenarioState, cards: ReadonlyMap<string, PrintedCard>): IslandReadout | null {
  const island = islandOf(game);
  if (!island) return null;
  const cells = island.cells.map((id, at): IslandCell => {
    const card = game.cards[id];
    const row = Math.floor(at / COLS);
    const col = at % COLS;
    const temple = col === TEMPLE_COLUMN;
    const state: IslandState = id === game.activeLocation ? "active" : card?.face === "B" ? "covered" : "explored";
    const next = card?.zone === "staging";
    const printed = card ? cards.get(card.code) : undefined;
    const points = state === "covered" || !card || !printed ? null : questPointsOf(game, card, cards);
    const progress = card?.progress ?? 0;
    const secret = temple && cardsUnder(game, id).length > 0;
    const name = nameOf(game, id, cards, temple);
    const words = [
      `${place(row, col)}: ${name}`,
      state === "active" ? "active location, the marker is here" : state === "covered" ? "not explored" : "explored",
      next ? "next to the active location" : "",
      progressWords(progress, points),
      secret ? "a secret lies under it" : "",
    ]
      .filter((part) => part !== "")
      .join(", ");
    return { id, row, col, state, next, temple, secret, name, progress, points, words };
  });
  const active = cells.find((cell) => cell.state === "active") ?? null;
  return { cells, active, staging: cells.filter((cell) => cell.next).length, mayTravel: islandMayTravel(game, cards), covered: cells.filter((cell) => cell.state === "covered").length };
}

/** What the chip says: "Island Map, active: row 2, column 1, Cursed Temple, 3 locations in staging". */
export function chipWords(readout: IslandReadout): string {
  const active = readout.active;
  const where = active ? `active: ${place(active.row, active.col)}, ${active.name}` : "no active location";
  const staging = `${readout.staging} ${readout.staging === 1 ? "location" : "locations"} in staging`;
  return `Island Map, ${where}, ${staging}`;
}

/** The line under the grid: where the players stand and what they need to travel on. */
export function standingWords(readout: IslandReadout): string {
  const active = readout.active;
  if (!active) return "No location is active yet.";
  const need = active.points == null ? "" : active.progress >= active.points ? " It is full: the players may travel from it." : ` It needs ${active.points - active.progress} more progress before the players can travel from it.`;
  return `The marker is on ${active.name} (${place(active.row, active.col)}).${need}`;
}

/** What the legend explains, in the order of the grid's states. */
export const LEGEND: readonly { state: IslandState | "next"; word: string }[] = [
  { state: "active", word: "Active" },
  { state: "next", word: "In staging" },
  { state: "explored", word: "Explored" },
  { state: "covered", word: "Not explored" },
];

// ---- Geometry. All sizes are logical points at Medium, as the other table layouts; the panel is drawn at scale `s`. ----

export const TILE_GAP = 6;
export const PANEL_PAD = 12;
// What the panel spends above and below its grid: eyebrow and title, the legend line, the standing line, the close button's room.
const CHROME = 150;
// A tile is about as wide as tall; it never gets thinner than a thumb (TOUCH_FLOOR) or wider than this.
const TILE_MAX = 64;

export type IslandFit = {
  tileW: number;
  tileH: number;
  gap: number;
  // The grid's width and height.
  gridW: number;
  gridH: number;
  // Whether the whole panel (grid and chrome) fits its box; the grid is never cut, it shrinks first.
  fits: boolean;
};

/** The size of a tile in a panel `width` wide and at most `maxHeight` tall (screen points), at UI scale `s`: five across, three down, as large as the room allows. */
export function islandFit(width: number, maxHeight: number, s: number): IslandFit {
  const gap = TILE_GAP * s;
  const across = (width - 2 * PANEL_PAD * s - (COLS - 1) * gap) / COLS;
  const down = (maxHeight - CHROME * s - (ROWS - 1) * gap) / ROWS;
  const tileW = Math.max(0, Math.min(across, TILE_MAX * s));
  const tileH = Math.max(0, Math.min(tileW * 1.1, down));
  const gridW = COLS * tileW + (COLS - 1) * gap;
  const gridH = ROWS * tileH + (ROWS - 1) * gap;
  return { tileW, tileH, gap, gridW, gridH, fits: tileW >= touch(s, 44) * 0.8 && tileH >= 28 * s && gridW + 2 * PANEL_PAD * s <= width + 0.5 && gridH + CHROME * s <= maxHeight + 0.5 };
}

/** The chip's mini grid: five cells across and three down, each a small square, drawn inside a 44 pt target. */
export const CHIP = { cell: 7, gap: 2, pad: 6 } as const;
export const chipWidth = (): number => COLS * CHIP.cell + (COLS - 1) * CHIP.gap + 2 * CHIP.pad;
export const chipHeight = (): number => ROWS * CHIP.cell + (ROWS - 1) * CHIP.gap + 2 * CHIP.pad;
