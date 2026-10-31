import { describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { modifiedStat } from "../keywords.ts";
import { syncConstants } from "../constants.ts";
import { updateCard, type ScenarioState } from "../state.ts";
import { recordSide, recordsOfFace, shownSide } from "./dreamchaser-faces.ts";
import { effectsOfCard } from "./misc-text.ts";
import { hero, table } from "./defense-table.ts";
import { seaTable, ship } from "./sea-table.ts";

// Rules: dcce.scalable-upgradable, dcce.campaign-mode (data/rules/entries.json). A two-sided card works with the records of the side it shows: a
// card dealt on its Upgraded side, side B, hears the abilities printed there and none printed on side A.
const plus = (id: string, line: string, amount: number): Effect => ({
  id,
  cardCode: "boat",
  lines: [line],
  timing: "constant",
  instructions: [{ verb: "ModifyStat", stat: "willpower", amount, until: "whileSourceInPlay", target: "self" }],
});

const A = plus("boat:constant:1", "boat:A:1", 1);
const B = plus("boat:constant:2", "boat:B:1", 4);
const BOTH: Effect = { ...plus("boat:constant:3", "boat:A:2", 10), lines: ["boat:A:2", "boat:B:2"] };

describe("a record's side", () => {
  it("is the side all of its lines are on, and none for a record on both", () => {
    expect(recordSide(A)).toBe("A");
    expect(recordSide(B)).toBe("B");
    expect(recordSide(BOTH)).toBeNull();
  });

  it("is shown as B only by a card turned to its side B", () => {
    expect(shownSide({ face: "B" })).toBe("B");
    expect(shownSide({ face: "up" })).toBe("A");
    expect(shownSide({ face: "A" })).toBe("A");
  });
});

describe("recordsOfFace", () => {
  it("keeps the records of the side shown, and those on both sides", () => {
    expect(recordsOfFace({ face: "up", zone: "play" }, [A, B, BOTH])).toEqual([A, BOTH]);
    expect(recordsOfFace({ face: "B", zone: "play" }, [A, B, BOTH])).toEqual([B, BOTH]);
  });

  it("keeps every record of a card whose records are all on one side", () => {
    expect(recordsOfFace({ face: "B", zone: "play" }, [A])).toEqual([A]);
  });

  it("keeps every record of a quest stage, which shows its side B but keeps the A-side lines it was revealed with", () => {
    expect(recordsOfFace({ face: "B", zone: "questStage" }, [A, B])).toEqual([A, B]);
  });
});

function boatTable(face: "up" | "B"): { state: ScenarioState; boat: string; ctx: ReturnType<typeof table>["ctx"] } {
  const built = table({ cards: [hero("aragorn"), { ...hero("boat"), type: "ally", willpower: 2 }], effects: [A, B], heroes: [{ code: "aragorn" }], allies: [{ code: "boat" }] });
  const boat = built.ids.boat ?? "";
  const state = syncConstants(updateCard(built.state, boat, { face }), built.ctx);
  return { state, boat, ctx: built.ctx };
}

describe("a constant record in play", () => {
  it("works only for the side the card shows: +1 Willpower on side A, +4 on side B, never both", () => {
    const up = boatTable("up");
    expect(modifiedStat(up.state, up.state.cards[up.boat]!, "willpower", up.ctx.cards)).toBe(3);
    const upgraded = boatTable("B");
    expect(modifiedStat(upgraded.state, upgraded.state.cards[upgraded.boat]!, "willpower", upgraded.ctx.cards)).toBe(6);
    expect(effectsOfCard(upgraded.state, upgraded.ctx, upgraded.state.cards[upgraded.boat]!)).toEqual([B]);
  });
});

describe("a ship-objective dealt on its Upgraded side", () => {
  it("has the stats side B prints: its willpower, attack, defense and hit points", () => {
    const built = seaTable({
      cards: [hero("aragorn"), ship("dc", "Dream-chaser", { willpower: 5, attack: 4, defense: 4, health: 18, upgraded: { willpower: 6, attack: 5, defense: 5, health: 19 } })],
      effects: [],
      heroes: [{ code: "aragorn" }],
      allies: [{ code: "dc" }],
    });
    const id = built.ids.dc ?? "";
    const read = (state: ScenarioState, stat: "willpower" | "attack" | "defense" | "hitPoints") => modifiedStat(state, state.cards[id]!, stat, built.ctx.cards);
    expect([read(built.state, "willpower"), read(built.state, "attack"), read(built.state, "defense"), read(built.state, "hitPoints")]).toEqual([5, 4, 4, 18]);
    const upgraded = updateCard(built.state, id, { face: "B" });
    expect([read(upgraded, "willpower"), read(upgraded, "attack"), read(upgraded, "defense"), read(upgraded, "hitPoints")]).toEqual([6, 5, 5, 19]);
  });
});
