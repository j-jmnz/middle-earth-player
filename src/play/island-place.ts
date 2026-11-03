// Rules: dcce.island-map, dcce.exploration (data/rules/entries.json). Where a location lies on the Island Map, told from the marker (docs/design-system-table.md, The Island Map): a travel row leads with the direction
// ("Right of the marker", "2 right, 1 down") and a small 5 × 3 glyph with the location lit, and a location in the staging area wears the same glyph. Pure. The words name a place, never the side that lies down.
import { COLS, ROWS } from "../rules/families/island/map.ts";

export type Spot = { row: number; col: number };

/** A map location's place on the grid, and where the marker stands when it is a different one (null for the active location itself). */
export type PlaceMark = { row: number; col: number; from: Spot | null };

/** How far the place is from the marker as a direction: the neighbors by their side ("Right of the marker"), anything further by steps ("2 right, 1 down"). Empty for the marker's own place. */
export function directionWords(from: Spot, to: Spot): string {
  const across = to.col - from.col;
  const down = to.row - from.row;
  if (across === 0 && down === 0) return "";
  if (Math.abs(across) + Math.abs(down) === 1) return across > 0 ? "Right of the marker" : across < 0 ? "Left of the marker" : down > 0 ? "Below the marker" : "Above the marker";
  const parts = [across === 0 ? "" : `${Math.abs(across)} ${across > 0 ? "right" : "left"}`, down === 0 ? "" : `${Math.abs(down)} ${down > 0 ? "down" : "up"}`];
  return parts.filter((part) => part !== "").join(", ");
}

/** What the mark says: the direction from the marker, or the row and column when no marker stands. */
export function placeWords(mark: PlaceMark): string {
  return mark.from ? directionWords(mark.from, mark) : `row ${mark.row + 1}, column ${mark.col + 1}`;
}

/** The glyph's cells, row by row, true for the lit one: five across, three down, as the map is laid out. */
export function glyphCells(mark: Spot): boolean[][] {
  return Array.from({ length: ROWS }, (_, row) => Array.from({ length: COLS }, (_, col) => row === mark.row && col === mark.col));
}
