// Rules: rr.in-play-and-out-of-play, rr.objective-cards, rr.surge, rr.shadow-effects, ltp.undefended-attack, rr.forced, rr.resource-phase (data/rules/entries.json).
// Lines: 900302:A:1, 900303:A:2, 900304:A:1, 900304:A:2, 900306:A:2, 900308:A:2, 01134:A:1. The Escape from Dol Guldur Nightmare cards and the Appointed by Fate boon whose lines no test named, each read from its
// printed line on a table built from data/ (test/harness/layout.ts, tableFromLayout): the rows run again without the records of their line (test/harness/card-spec.ts, cardSpecs), and the other tests do so with withoutLine.
// The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points and every seat starts at threat 28; f3 is an enemy with Attack 1; `place` is a location with no trait.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { updateCard } from "../../../rules/core/state.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { announce, attack, cardSpecs, damageOn, endRound, reveal, resourcesOn, rowProblems, withoutLine, zone, type Row } from "../../../../test/harness/card-spec.ts";
import { finish, idOf, tableFromLayout } from "../../../../test/harness/scene-kit.ts";

const ID = "escape-from-dol-guldur";
const TORTURE_MASTER = "900302";
const CAPTIVE = "900303";
const SPIDER = "900304";
const CHAMBER = "900305"; // Torture Chamber, a Dol Guldur location
const LABYRINTH = "900306"; // Dungeon Labyrinth, a Dol Guldur location
const INSPECTION = "900308";
const MAP = "01108"; // Gandalf's Map, an objective
const APPOINTED = "01134";

// "Add 1 resource token to each Dol Guldur location in play": the one in the staging area and the active one are both in play (rr.in-play-and-out-of-play); a location without the trait takes none.
const DOL_GULDUR_PLACES = { staging: [LABYRINTH, "place"], active: CHAMBER, deck: ["f0", "f0"] } as const;

const ROWS: readonly Row[] = [
  { line: "900302:A:1", name: "When Revealed: each Dol Guldur location in play, staging area and active alike, takes 1 resource token", layout: DOL_GULDUR_PLACES, act: reveal(TORTURE_MASTER), expect: [resourcesOn(LABYRINTH, 1), resourcesOn(CHAMBER, 1), resourcesOn("place", 0)] },
  { line: "900308:A:2", name: "When Revealed: each Dol Guldur location in play, staging area and active alike, takes 1 resource token", layout: DOL_GULDUR_PLACES, act: reveal(INSPECTION), expect: [resourcesOn(LABYRINTH, 1), resourcesOn(CHAMBER, 1), resourcesOn("place", 0)] },

  // "If there are any unclaimed objectives in play, Spider of Dol Guldur gains surge." The surge reveals the f0 under it.
  { line: "900304:A:1", name: "with an unclaimed objective in the staging area it gains surge", layout: { phase: "Encounter", staging: [MAP], deck: ["f0"] }, act: reveal(SPIDER), expect: zone("f0", "staging") },
  // "Shadow: Attacking enemy gets +3 Attack for each unclaimed objective in play." Undefended, the Attack 1 enemy deals 1 + 3 to the hero.
  { line: "900304:A:2", name: "Shadow: +3 Attack for an unclaimed objective in play", layout: { staging: [MAP] }, act: attack("f3", { shadow: SPIDER, undefended: true }), expect: damageOn("dh1", 4) },

  // "Forced: At the end of each round, place 1 resource token on Dungeon Labyrinth for each player in the game."
  { line: "900306:A:2", name: "Forced at the end of the round: 1 resource token for each player, 2 two-handed", layout: { seats: 2, staging: [LABYRINTH] }, act: announce("endOfRound", LABYRINTH), expect: resourcesOn(LABYRINTH, 2) },

  // "Attached hero collects 1 additional resource during each resource phase." The combat phase and the round end, and the next resource phase pays each hero.
  { line: "01134:A:1", name: "the attached hero collects 1 additional resource in the resource phase, and the other hero does not", layout: { phase: "Combat", attached: [{ code: APPOINTED, to: "dh1" }] }, act: endRound, expect: [resourcesOn("dh1", 2), resourcesOn("dh2", 1)] },
];

cardSpecs(ID, ROWS);

// The false case of a condition holds with the records and without them alike, so it is a test of its own and not a row.
const holds = (row: Omit<Row, "line">, line: string) => expect(rowProblems(ID, { ...row, line }, EFFECTS)).toEqual([]);

describe("the false case of each condition", () => {
  it("900304:A:1 with no objective in play it gains no surge", () => {
    holds({ layout: { phase: "Encounter", deck: ["f0"] }, act: reveal(SPIDER), expect: zone("f0", "encounterDeck") }, "900304:A:1");
  });
  it("900304:A:1 a claimed objective is not unclaimed, so it gains no surge", () => {
    holds({ layout: { phase: "Encounter", attached: [{ code: MAP, to: "dh1" }], deck: ["f0"] }, act: reveal(SPIDER), expect: zone("f0", "encounterDeck") }, "900304:A:1");
  });
  it("900304:A:2 with no unclaimed objective the attacking enemy gets nothing", () => {
    holds({ layout: { attached: [{ code: MAP, to: "dh2" }] }, act: attack("f3", { shadow: SPIDER, undefended: true }), expect: damageOn("dh1", 1) }, "900304:A:2");
  });
  it("900306:A:2 one-handed it takes 1 resource token", () => {
    holds({ layout: { staging: [LABYRINTH] }, act: announce("endOfRound", LABYRINTH), expect: resourcesOn(LABYRINTH, 1) }, "900306:A:2");
  });
});

// "Forced: If Crazed Captive is defeated, raise each player's threat by 7." The Captive (1 hit point) engaged with the first player takes its 1 damage and the settle loop destroys it.
function defeatCaptive(effects: readonly Effect[]) {
  const t = tableFromLayout(ID, { seats: 2, engaged: [{ code: CAPTIVE, seat: 0 }] }, { effects });
  const steps: EngineStep[] = [];
  const damaged = updateCard({ ...t.state, window: null }, idOf(t.state, CAPTIVE), { damage: 1 });
  return finish({ state: settle(damaged, t.ctx, steps), steps }, t.ctx).state;
}

describe("Crazed Captive", () => {
  it("900303:A:2 defeated, it raises each player's threat by 7", () => {
    const state = defeatCaptive(EFFECTS);
    expect(state.cards[idOf(state, CAPTIVE)]?.zone).not.toBe("engaged");
    expect([state.seats[0]?.threat, state.seats[1]?.threat]).toEqual([35, 35]);
    const without = defeatCaptive(withoutLine(EFFECTS, "900303:A:2"));
    expect(without.seats[1]?.threat).toBe(28);
  });
});
