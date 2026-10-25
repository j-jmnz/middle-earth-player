import { describe, expect, it } from "vitest";

import { parseDecklist } from "./decklists.ts";

describe("parseDecklist", () => {
  it("reads headings with totals, counted rows with collector numbers, and bare hero rows", () => {
    const printed = parseDecklist("Heroes (3)\nAmarthiúl ( 1)\nHalbarad ( 2)\nAragorn ( 3)\nAllies (2)\n2x Ingold ( 11)\nSide Quests (1)\n1x Send for Aid ( 24)");
    expect(printed.rows).toEqual([
      { section: "hero", name: "Amarthiúl", collector: 1, qualifier: null, min: 1, max: 1 },
      { section: "hero", name: "Halbarad", collector: 2, qualifier: null, min: 1, max: 1 },
      { section: "hero", name: "Aragorn", collector: 3, qualifier: null, min: 1, max: 1 },
      { section: "ally", name: "Ingold", collector: 11, qualifier: null, min: 2, max: 2 },
      { section: "player-side-quest", name: "Send for Aid", collector: 24, qualifier: null, min: 1, max: 1 },
    ]);
    expect([...printed.totals]).toEqual([["hero", 3], ["ally", 2], ["player-side-quest", 1]]);
  });

  it("reads a printed range and trailing counts with a qualifier", () => {
    const printed = parseDecklist("Allies\n0-3x Elfhelm ( 13)\nGandalf (core set) x3");
    expect(printed.rows.map((row) => [row.name, row.qualifier, row.min, row.max])).toEqual([
      ["Elfhelm", null, 0, 3],
      ["Gandalf", "core set", 3, 3],
    ]);
  });

  it("joins a wrapped row, a collector on its own line, and a count printed above its name", () => {
    const printed = parseDecklist("Heroes (2)\nCírdan the Shipwright (\nGimli ( 4)\n5)\nAttachments (6)\n3x King Under the\nMountain\n3x Daughter of the Nimrodel\n( 58)\nA t t a c h m e n t ( 1)\n1x\nResourceful (The Watcher in the Water)");
    expect(printed.rows.map((row) => [row.section, row.name, row.collector, row.qualifier, row.max])).toEqual([
      ["hero", "Círdan the Shipwright", 5, null, 1],
      ["hero", "Gimli", 4, null, 1],
      ["attachment", "King Under the Mountain", null, null, 3],
      ["attachment", "Daughter of the Nimrodel", 58, null, 3],
      ["attachment", "Resourceful", null, "The Watcher in the Water", 1],
    ]);
  });

  it("gives each product line to the first row still without one, and fails on a count with no row", () => {
    const printed = parseDecklist("HE R O (2)\nCírdan the Shipwright\nErestor\n(The Grey Havens)\n(The Treachery of Rhudaur)");
    expect(printed.rows.map((row) => [row.name, row.qualifier])).toEqual([
      ["Círdan the Shipwright", "The Grey Havens"],
      ["Erestor", "The Treachery of Rhudaur"],
    ]);
    expect(() => parseDecklist("Allies\n3x\nEvents\nFeint x2")).toThrow("count with no row");
    expect(() => parseDecklist("Allies\nGandalf x3\n3x")).toThrow("count with no row");
  });
});
