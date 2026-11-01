// Rules: dcce.island-map, dcce.exploration (data/rules/entries.json). Where a location lies on the Island Map told from the marker: the words a travel row leads with, the glyph, and the mark a location in the staging area wears.
import { beforeAll, describe, expect, it } from "vitest";

import { loadTempleWorld, templeTable, type TempleWorld } from "../../scripts/temple-scene.ts";
import { slotNumbers } from "./card-effects.ts";
import { directionWords, glyphCells, placeWords } from "./island-place.ts";

let world: TempleWorld;

beforeAll(async () => {
  world = await loadTempleWorld();
});

const MAP = [
  "12072", "12073", "?12074", "?11072", "?12068",
  "?11073", "11074", "?12072", "?12073", "?12069",
  "12074", "?11072", "?11073", "?11074", "?12069",
] as const;

describe("directions from the marker", () => {
  const from = { row: 1, col: 1 };
  it("names a neighbor by its side and anything further by its steps", () => {
    expect(directionWords(from, { row: 1, col: 2 })).toBe("Right of the marker");
    expect(directionWords(from, { row: 1, col: 0 })).toBe("Left of the marker");
    expect(directionWords(from, { row: 0, col: 1 })).toBe("Above the marker");
    expect(directionWords(from, { row: 2, col: 1 })).toBe("Below the marker");
    expect(directionWords(from, { row: 2, col: 3 })).toBe("2 right, 1 down");
    expect(directionWords(from, { row: 0, col: 4 })).toBe("3 right, 1 up");
    expect(directionWords(from, { row: 1, col: 4 })).toBe("3 right");
    expect(directionWords(from, from)).toBe("");
  });

  it("says the row and column when no marker stands, and lights one cell of five by three", () => {
    expect(placeWords({ row: 2, col: 4, from: null })).toBe("row 3, column 5");
    expect(placeWords({ row: 1, col: 2, from })).toBe("Right of the marker");
    const cells = glyphCells({ row: 2, col: 4 });
    expect(cells).toHaveLength(3);
    expect(cells.every((row) => row.length === 5)).toBe(true);
    expect(cells.flat().filter(Boolean)).toHaveLength(1);
    expect(cells[2]?.[4]).toBe(true);
  });
});

describe("the mark on a location in the staging area", () => {
  it("gives every map location in the staging area its place and the marker's, and none elsewhere", () => {
    const made = templeTable(world, { map: MAP, at: 6, phase: "Travel", engaged: [{ code: "mild", seat: 0 }] });
    const next = made.cells[7] ?? "";
    expect(made.state.cards[next]?.zone).toBe("staging");
    expect(slotNumbers(made.state, made.ctx, next).place).toEqual({ row: 1, col: 2, from: { row: 1, col: 1 } });
    // A location outside the staging area is on the map, not on the table's staging row.
    expect(slotNumbers(made.state, made.ctx, made.cells[3] ?? "").place).toBeNull();
  });
});
