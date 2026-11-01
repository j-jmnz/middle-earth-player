// Rules: dcce.island-map, dcce.exploration (data/rules/entries.json); ledger lines 12067:A:1, 12067:B:1, 12072:A:1, 12074:A:1. The Island Map: fifteen double-sided locations in a grid of three rows by five columns, the
// active location marked where it lies, and the locations next to it (orthogonally, not diagonally) standing in the staging area. Which card stands where is read from the state (`uncharted.island` and
// the active location), never from the zone a card happens to be in: the zones follow it (syncIsland, run by settle), as the Stormcaller's area follows the stage (stormcaller-area.ts).
import type { ReduceContext } from "../interpret.ts";
import { shuffleIds } from "../seed.ts";
import type { ScenarioState } from "../state.ts";
import { heldAmount, updateCard } from "../state.ts";
import { syncConstants } from "../constants.ts";
import { moveCard } from "../zones.ts";
import type { IslandState } from "./uncharted-types.ts";

export const ROWS = 3;
export const COLS = 5;
/** The column of the three Temple of the Deceived locations, the right-hand one (dcce.island-map). */
export const TEMPLE_COLUMN = COLS - 1;

export type Cell = { row: number; col: number };

/** The Island Map of the game, or undefined when no Setup has laid one out. */
export function islandOf(state: Pick<ScenarioState, "uncharted">): IslandState | undefined {
  return state.uncharted?.island;
}

/** The Exploration keyword is in force (dcce.exploration): the quest stage holds it, and the map is laid out. */
export function exploring(state: ScenarioState): boolean {
  return islandOf(state) != null && heldAmount(state, "table", "exploration") > 0;
}

/** Where a location lies on the map, or null when it is not one of its fifteen. */
export function cellOf(island: IslandState, id: string): Cell | null {
  const at = island.cells.indexOf(id);
  return at < 0 ? null : { row: Math.floor(at / COLS), col: at % COLS };
}

/** The card at a row and column, or null off the grid. */
export function cardAt(island: IslandState, row: number, col: number): string | null {
  return row < 0 || row >= ROWS || col < 0 || col >= COLS ? null : (island.cells[row * COLS + col] ?? null);
}

/** The locations next to this one, orthogonally: above, left, right, below ("orthogonally, not diagonally", dcce.exploration). */
export function neighbors(island: IslandState, id: string): string[] {
  const cell = cellOf(island, id);
  if (!cell) return [];
  return [cardAt(island, cell.row - 1, cell.col), cardAt(island, cell.row, cell.col - 1), cardAt(island, cell.row, cell.col + 1), cardAt(island, cell.row + 1, cell.col)].filter((other): other is string => other != null);
}

/** The Temple of the Deceived locations of the map, top to bottom. */
export function templeCells(state: Pick<ScenarioState, "uncharted">): string[] {
  const island = islandOf(state);
  return island ? Array.from({ length: ROWS }, (_, row) => cardAt(island, row, TEMPLE_COLUMN)).filter((id): id is string => id != null) : [];
}

/** How many orthogonal steps lie between two locations of the map, or null when one is not on it. */
export function distance(island: IslandState, a: string, b: string): number | null {
  const from = cellOf(island, a);
  const to = cellOf(island, b);
  return from && to ? Math.abs(from.row - to.row) + Math.abs(from.col - to.col) : null;
}

/** The locations up to `steps` locations away (orthogonal steps, over any card of the grid), not the location itself (12073:A:2). */
export function within(island: IslandState, id: string, steps: number): string[] {
  return island.cells.filter((other) => {
    const away = distance(island, id, other);
    return other !== id && away != null && away >= 1 && away <= steps;
  });
}

/** The locations to the left of this one in its row, the nearest first ("to the left of the active location (in its row)", 12078:A:1). */
export function leftOf(island: IslandState, id: string): string[] {
  const cell = cellOf(island, id);
  if (!cell) return [];
  return Array.from({ length: cell.col }, (_, step) => cardAt(island, cell.row, cell.col - 1 - step)).filter((other): other is string => other != null);
}

/** The locations next to the active location that the active location does not shut out of the staging area (12072:A:1: the one to its right; 12074:A:1: the ones above and below). */
export function stagingCells(state: ScenarioState): string[] {
  const island = islandOf(state);
  const active = state.activeLocation;
  if (!island || !active) return [];
  const cell = cellOf(island, active);
  if (!cell) return [];
  const shut = heldAmount(state, active, "islandBlock");
  const out = new Set<string>();
  if (shut === 1) {
    const right = cardAt(island, cell.row, cell.col + 1);
    if (right) out.add(right);
  }
  if (shut === 2) {
    for (const other of [cardAt(island, cell.row - 1, cell.col), cardAt(island, cell.row + 1, cell.col)]) if (other) out.add(other);
  }
  return neighbors(island, active).filter((other) => !out.has(other));
}

// A location of the map that is still on it: in play where the map has it. One that has left (the victory display, a discard pile) is not placed any more.
const ON_MAP = new Set(["staging", "islandMap", "activeLocation"]);

/** The cards of the map stand where the active location says: the active location in its slot, the locations next to it in the staging area, the rest in the map (dcce.exploration). The state is returned
 * unchanged when nothing moves. The constants are synced first, so a location that shuts its neighbor out (islandBlock) is read at the side it shows now. */
export function syncIsland(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  const island = islandOf(state);
  if (!island || state.uncharted == null) return state;
  const synced = syncConstants(state, ctx);
  const inStaging = new Set(stagingCells(synced));
  let next = synced;
  for (const id of island.cells) {
    const card = next.cards[id];
    if (!card || !ON_MAP.has(card.zone) || id === next.activeLocation) continue;
    const want = inStaging.has(id) ? "staging" : "islandMap";
    if (card.zone !== want) next = moveCard(next, id, { zone: want });
  }
  return next === synced ? state : next;
}

/** PrepareIslandMap: the dealt locations leave the Uncharted deck and are laid out, the Temple ones in the right-hand column and the others in the first four, each group shuffled by the seed. */
export function prepareMap(state: ScenarioState, temple: readonly string[]): ScenarioState {
  const deck = state.uncharted?.deck ?? [];
  const isTemple = (id: string): boolean => temple.includes(state.cards[id]?.code ?? "");
  const rightHand = deck.filter(isTemple);
  const others = deck.filter((id) => !isTemple(id));
  if (rightHand.length !== ROWS || others.length !== ROWS * (COLS - 1)) return { ...state, failure: `The Island Map needs ${ROWS * COLS} locations, ${ROWS} of them Temple of the Deceived` };
  const lost = shuffleIds(others, state.seed, state.seedCursor);
  const column = shuffleIds(rightHand, state.seed, lost.cursor);
  const cells = Array.from({ length: ROWS * COLS }, (_, at) => {
    const col = at % COLS;
    const row = Math.floor(at / COLS);
    return (col === TEMPLE_COLUMN ? column.ids[row] : lost.ids[row * TEMPLE_COLUMN + col]) ?? "";
  });
  let next: ScenarioState = { ...state, seedCursor: column.cursor };
  for (const id of cells) next = moveCard(next, id, { zone: "islandMap" });
  const uncharted = next.uncharted ?? { deck: [], codes: [] };
  return { ...next, uncharted: { ...uncharted, island: { cells } } };
}

/** RevealIslandCorners: the top-left and bottom-left locations turn to their other side, and nothing they say happens (12067:A:1). */
export function revealCorners(state: ScenarioState): ScenarioState {
  const island = islandOf(state);
  if (!island) return state;
  const corners = [cardAt(island, 0, 0), cardAt(island, ROWS - 1, 0)].filter((id): id is string => id != null);
  return corners.reduce((current, id) => updateCard(current, id, { face: "A" }), state);
}

/** The corners RevealIslandCorners turned, for the starting active location's choice. */
export function startCells(state: ScenarioState): string[] {
  const island = islandOf(state);
  if (!island || state.activeLocation) return [];
  return [cardAt(island, 0, 0), cardAt(island, ROWS - 1, 0)].filter((id): id is string => id != null && state.cards[id]?.face === "A");
}

/** SetIslandActive: the location is the active location where it lies. */
export function setActive(state: ScenarioState, id: string | null | undefined): ScenarioState {
  const island = islandOf(state);
  if (!island || !id || !island.cells.includes(id)) return state;
  const old = state.activeLocation;
  const cleared = old && old !== id ? moveCard(state, old, { zone: "islandMap" }) : state;
  return moveCard(cleared, id, { zone: "activeLocation" });
}
