// Rules: dcce.island-map, dcce.exploration, dcce.uncharted (data/rules/entries.json). The Island Map as the table shows it (docs/design-system-table.md, The Island Map): a chip in the top bar and a reading panel, both drawn from
// one readout of the game. Pure, so a test reads it. Nothing here changes the game, and nothing here says what lies on the facedown side of a location: a location lying Uncharted side up is "Lost Island" (or, in the
// Temple column, "Temple of the Deceived") and nothing else, as the staging area and the card preview show it (shown-name.ts).
import { islandOf, TEMPLE_COLUMN, COLS, ROWS } from "../../rules/families/island/map.ts";
import { islandMayTravel } from "../../rules/families/island/travel.ts";
import { questPointsOf } from "../../rules/quest/quest.ts";
import type { PrintedCard } from "../../rules/core/printed.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import { cardsUnder } from "../../rules/core/zones.ts";

import { LOST_ISLAND_NAME, TEMPLE_NAME } from "../words/uncharted.ts";
import { touch } from "../../ui/ui-scale.ts";

export { COLS, ROWS, TEMPLE_NAME };


/** How a location of the map is drawn: covered (Uncharted side up, its real side facedown), revealed (flipped over, shows the location it is, but the players have not traveled from it), explored (the players traveled
 * from it, dcce.exploration), or the active one, where the marker stands. */
export type IslandState = "covered" | "revealed" | "explored" | "active";

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
  // How many locations still lie covered, and how many the players have explored (traveled from).
  covered: number;
  explored: number;
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
    const state: IslandState = id === game.activeLocation ? "active" : card?.face === "B" ? "covered" : island.explored?.includes(id) ? "explored" : "revealed";
    const next = card?.zone === "staging";
    const printed = card ? cards.get(card.code) : undefined;
    const points = state === "covered" || !card || !printed ? null : questPointsOf(game, card, cards);
    const progress = card?.progress ?? 0;
    const secret = temple && cardsUnder(game, id).length > 0;
    const name = nameOf(game, id, cards, temple);
    const words = [
      `${place(row, col)}: ${name}`,
      state === "active" ? "active location, the marker is here" : state === "covered" ? "not explored" : state === "revealed" ? "revealed, not explored" : "explored",
      next ? "next to the active location" : "",
      progressWords(progress, points),
      secret ? "a secret lies under it" : "",
    ]
      .filter((part) => part !== "")
      .join(", ");
    return { id, row, col, state, next, temple, secret, name, progress, points, words };
  });
  const active = cells.find((cell) => cell.state === "active") ?? null;
  return { cells, active, staging: cells.filter((cell) => cell.next).length, mayTravel: islandMayTravel(game, cards), covered: cells.filter((cell) => cell.state === "covered").length, explored: cells.filter((cell) => cell.state === "explored").length };
}

/** What the chip says: "Island Map, active: row 2, column 1, Cursed Temple, 3 locations in staging, 2 of 15 explored, the players may not travel yet". */
export function chipWords(readout: IslandReadout): string {
  const active = readout.active;
  const where = active ? `active: ${place(active.row, active.col)}, ${active.name}` : "no active location";
  const staging = `${readout.staging} ${readout.staging === 1 ? "location" : "locations"} in staging`;
  return `Island Map, ${where}, ${staging}, ${readout.explored} of ${readout.cells.length} explored, ${readout.mayTravel ? "the players may travel" : "the players may not travel yet"}`;
}

/** The one or two lines a tile shows (the second is smaller): a covered one "?", the active one the marker over its progress, an explored one its progress or a check over its quest points, a revealed one its progress. */
export function tileMarks(cell: Pick<IslandCell, "state" | "progress" | "points">): readonly [string, string | null] {
  const progress = cell.points == null ? null : `${cell.progress}/${cell.points}`;
  if (cell.state === "covered") return ["?", null];
  if (cell.state === "active") return ["\u25CF", progress];
  if (cell.state === "explored") return cell.progress > 0 && progress ? [progress, null] : ["\u2713", cell.points == null ? null : String(cell.points)];
  return [progress ?? "", null];
}

/** The line under the grid: where the players stand and what they need to travel on. */
export function standingWords(readout: IslandReadout): string {
  const active = readout.active;
  if (!active) return "No location is active yet.";
  const need = active.points == null ? "" : active.progress >= active.points ? " It is full: the players may travel from it." : ` It needs ${active.points - active.progress} more progress before the players can travel from it.`;
  const columns = TEMPLE_COLUMN - active.col;
  const temple = columns > 0 ? ` The Temple is ${columns} ${columns === 1 ? "column" : "columns"} to the right.` : " The marker is in the Temple column.";
  return `The marker is on ${active.name} (${place(active.row, active.col)}).${need}${temple}`;
}

/** What the legend explains, in the order of the grid's states; the Temple column's label and the secret mark follow it in the panel. */
export const LEGEND: readonly { state: IslandState | "next"; word: string }[] = [
  { state: "active", word: "Active" },
  { state: "next", word: "In staging" },
  { state: "explored", word: "Explored" },
  { state: "revealed", word: "Revealed" },
  { state: "covered", word: "Not explored" },
];
/** The word over the Temple column and in the legend (dcce.island-map: the three Temple of the Deceived locations lie in the right-hand column). */
export const TEMPLE_LABEL_WORD = "Temple";
const LEGEND_WORDS: readonly string[] = [...LEGEND.map((item) => item.word), TEMPLE_LABEL_WORD, "Secret"];

// ---- Geometry. All sizes are logical points at Medium, as the other table layouts; the panel is drawn at scale `s`. ----

export const TILE_GAP = 6;
export const PANEL_PAD = 12;
// A tile is about as wide as tall; it never gets thinner than a thumb (touch(s, 44)) or wider than this.
const TILE_MAX = 64;
// What the panel spends outside the grid and its words, from the frame and the lines it draws (type sizes in tailwind.config.js): the frame's 10 above and 8 below, the title (24) with the count of explored locations beside it on the same line,
// the scroll's 4 above the grid, and the "Temple" label over the last column (one 17 pt line).
const FRAME_V = 18;
const HEADER = 24 + 4;
const TEMPLE_LABEL_H = 17;
/** What the "Choice waiting" line under the panel takes while a choice is open (4 above, one 17 pt line). */
export const WAITING = 21;
// Beside the grid (a wide panel), the words keep this much width at least; under it they use the grid's.
const SIDE_MIN = 170;
const SIDE_GAP = 12;
const TEXT_GAP = 8;
/** The widest the map's panel is: wider than the reading frame, so the words stand beside the grid in landscape. */
export const ISLAND_WIDE = 560;
// The widest a letter of Barlow Semi Condensed gets, for counting lines (top-bar-layout.ts counts the same).
const EM = 0.55;

/** The width the map's panel takes: the reading frame's `width`, or up to ISLAND_WIDE when the screen leaves `room`. */
export function islandPanelWidth(width: number, room: number, s: number): number {
  return Math.max(width, Math.min(room, ISLAND_WIDE * s));
}

export type IslandFit = {
  tileW: number;
  tileH: number;
  gap: number;
  // The grid's width and height.
  gridW: number;
  gridH: number;
  // The words stand beside the grid (`beside`) or under it (`below`), and the width the words have.
  layout: "beside" | "below";
  textW: number;
  // Whether the whole panel (header, grid, words) fits its box with every tile at least a thumb in both directions; the grid is never cut, it shrinks first; when it cannot fit at thumb size `fits` is false and the panel scrolls.
  fits: boolean;
};

// The height of `chars` letters of text set `size` pt on lines `line` pt apart in a column `w` wide.
const textHeight = (chars: number, w: number, size: number, line: number, s: number): number => Math.ceil(chars / Math.max(1, Math.floor(w / (size * EM * s)))) * line * s;

// The legend's items flow in rows (a swatch, a word, a gap); the rows it takes in a column `w` wide.
function legendHeight(w: number, s: number): number {
  let rows = 1;
  let used = 0;
  for (const word of LEGEND_WORDS) {
    const item = (12 + 4 + 10) * s + word.length * 13 * EM * s;
    if (used > 0 && used + item > w) {
      rows += 1;
      used = 0;
    }
    used += item;
  }
  return rows * 17 * s + (rows - 1) * 6 * s;
}

/**
 * The size of a tile in a panel `width` wide and at most `maxHeight` tall (screen points, less the "Choice waiting" line while a choice is open), at UI scale `s`: five across, three down, every tile at least
 * a thumb (touch(s, 44)) wide and tall, as large as the room allows. `standing` is the sentence under the marker's place, counted for the room the words need. The words stand beside the grid when the panel is wide
 * enough, else under it; the header's and the words' heights are counted from their type sizes, not guessed.
 */
export function islandFit(width: number, maxHeight: number, s: number, standing = ""): IslandFit {
  const gap = TILE_GAP * s;
  const inner = width - 2 * PANEL_PAD * s;
  const floor = touch(s, 44);
  const head = (FRAME_V + HEADER) * s;
  const label = TEMPLE_LABEL_H * s;
  const wordsHeight = (w: number): number => textHeight(standing.length, w, 15, 20, s) + TEXT_GAP * s + legendHeight(w, s);
  const grid = (tileW: number, tileH: number) => ({ gridW: COLS * tileW + (COLS - 1) * gap, gridH: ROWS * tileH + (ROWS - 1) * gap });
  const down = (spent: number): number => (maxHeight - spent - label - (ROWS - 1) * gap) / ROWS;
  // Beside the grid: the largest tile that leaves the words their room and the panel its height.
  for (let tileW = Math.min(TILE_MAX * s, (inner - (COLS - 1) * gap - SIDE_GAP * s - SIDE_MIN * s) / COLS); tileW >= floor; tileW -= 1) {
    const tileH = Math.min(tileW * 1.1, down(head));
    if (tileH < floor) break;
    const { gridW, gridH } = grid(tileW, tileH);
    const textW = inner - gridW - SIDE_GAP * s;
    if (Math.max(gridH + label, wordsHeight(textW)) + head <= maxHeight + 0.5) return { tileW, tileH, gap, gridW, gridH, layout: "beside", textW, fits: true };
  }
  // Under the grid: the words take the grid's width and the height it leaves.
  const tileW = Math.max(0, Math.min((inner - (COLS - 1) * gap) / COLS, TILE_MAX * s));
  // A narrow panel wraps the count of explored locations under the title: one more line.
  const spent = head + 16 * s + TEXT_GAP * s + wordsHeight(inner);
  const tileH = Math.max(0, Math.min(tileW * 1.1, down(spent)));
  const { gridW, gridH } = grid(tileW, tileH);
  const fits = tileW >= floor && tileH >= floor && gridW <= inner + 0.5 && gridH + label + spent <= maxHeight + 0.5;
  if (fits || tileW < floor) return { tileW, tileH, gap, gridW, gridH, layout: "below", textW: inner, fits };
  // The room cannot hold the header, the grid and the words at once (Extra large on a short phone): the tiles keep their thumb size, never shrinking
  // under it, and the panel's scroll carries what does not fit, the words beside the grid when it leaves them room, else under it.
  const small = grid(floor, floor);
  const textW = inner - small.gridW - SIDE_GAP * s;
  if (textW >= SIDE_MIN * s && small.gridH + label + head <= maxHeight + 0.5) return { tileW: floor, tileH: floor, gap, gridW: small.gridW, gridH: small.gridH, layout: "beside", textW, fits: false };
  const { gridW: floorW, gridH: floorH } = grid(tileW, floor);
  return { tileW, tileH: floor, gap, gridW: floorW, gridH: floorH, layout: "below", textW: inner, fits: false };
}

/** The chip's mini grid: five cells across and three down, each a small square, drawn inside a 44 pt target. */
export const CHIP = { cell: 7, gap: 2, pad: 6 } as const;
export const chipWidth = (): number => COLS * CHIP.cell + (COLS - 1) * CHIP.gap + 2 * CHIP.pad;
export const chipHeight = (): number => ROWS * CHIP.cell + (ROWS - 1) * CHIP.gap + 2 * CHIP.pad;
