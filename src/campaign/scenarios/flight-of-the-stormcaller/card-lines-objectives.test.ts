// Rules: dcce.encounter-cards, dcce.scalable-upgradable, dcce.immune, rr.immune, rr.removed-from-game, rr.forced (data/rules/entries.json).
// Lines: 11192:A:1, 11192:A:2, 11192:A:3, 11192:B:1, 11192:B:2, 11193:A:1, 11193:B:1. Black Key (burden) and Calaerion, the cards Flight of the Stormcaller's campaign card puts out, on both sides, each read from
// its printed line on a table of plain-number heroes (test/scenarios/flight-of-the-stormcaller/scene.ts).
import { beforeAll, describe, expect, it } from "vitest";

import { modifiedStat } from "../../../rules/core/keywords.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { flagged, withMode, type ScenarioState } from "../../../rules/core/state.ts";
import { attachTo, moveCard, spawn } from "../../../rules/core/zones.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { CODES, flightTable, idOf, loadFlightWorld, type FlightLayout, type FlightWorld } from "../../../../test/scenarios/flight-of-the-stormcaller/scene.ts";

let world: FlightWorld;

beforeAll(async () => {
  world = await loadFlightWorld();
});

const make = (layout: FlightLayout = {}) => flightTable(world, layout);
type Table = ReturnType<typeof make>;

const SAHIR = "11076";

// Black Key on the Stormcaller's Campaign Mode only side, on the key's side A ("up") or its Upgraded side B.
function withKey(layout: FlightLayout, face: "up" | "B"): Table & { key: string } {
  const made = make({ campaignSide: true, ...layout });
  const key = spawn(made.state, CODES.blackKey, { zone: "play", seat: 0 }, face);
  return { ...made, state: syncConstants(attachTo(key.state, key.id, made.caller), made.ctx), key: key.id };
}
const statsOf = (state: ScenarioState, id: string): number[] => (["threat", "attack", "defense"] as const).map((stat) => modifiedStat(state, state.cards[id]!, stat, world.cards));
// The quest phase ends: the encounter phase begins.
const questEnds = (made: Table): ScenarioState => settle(withMode({ ...made.state, window: null, mode: "resolution" }, "optionalEngage"), made.ctx, []);

describe("Black Key (11192)", () => {
  it("11192:A:2 gives the attached enemy +1 Threat, +1 Attack and +1 Defense, and immunity to player card effects", () => {
    const bare = make({ campaignSide: true });
    const keyed = withKey({}, "up");
    const [threat, attack, defense] = statsOf(bare.state, bare.caller);
    expect(statsOf(keyed.state, keyed.caller)).toEqual([threat! + 1, attack! + 1, defense! + 1]);
    expect(flagged(bare.state, bare.caller, "immuneToPlayerCards")).toBe(false);
    expect(flagged(keyed.state, keyed.caller, "immuneToPlayerCards")).toBe(true);
  });

  it("11192:B:2 gives the attached enemy the same on its Upgraded side", () => {
    const bare = make({ campaignSide: true });
    const keyed = withKey({}, "B");
    const [threat, attack, defense] = statsOf(bare.state, bare.caller);
    expect(statsOf(keyed.state, keyed.caller)).toEqual([threat! + 1, attack! + 1, defense! + 1]);
    expect(flagged(keyed.state, keyed.caller, "immuneToPlayerCards")).toBe(true);
  });

  it("11192:A:3 places 1 resource for each player on Captain Sahír at the end of the quest phase, with one player and with two", () => {
    for (const seats of [1, 2] as const) {
      const state = questEnds(withKey({ seats, staging: [SAHIR] }, "up"));
      expect(state.cards[idOf(state, SAHIR)]?.resources, String(seats)).toBe(seats);
    }
  });

  it("11192:A:3 places nothing while Captain Sahír is out of play, and nothing at the end of another phase", () => {
    const aside = questEnds(withKey({ setAside: [SAHIR] }, "up"));
    expect(aside.cards[idOf(aside, SAHIR)]?.resources).toBe(0);
    const made = withKey({ staging: [SAHIR], phase: "Travel" }, "up");
    const travelEnds = settle(withMode({ ...made.state, window: null }, "optionalEngage"), made.ctx, []);
    expect(travelEnds.phase).toBe("Encounter");
    expect(travelEnds.cards[idOf(travelEnds, SAHIR)]?.resources).toBe(0);
  });

  it("11192:A:1 11192:B:1 is removed from the game when it leaves play, on either side", () => {
    for (const face of ["up", "B"] as const) {
      const made = withKey({}, face);
      const state = settle(moveCard(made.state, made.key, { zone: "encounterDiscard" }), made.ctx, []);
      expect(state.cards[made.key]?.zone, face).toBe("removed");
    }
  });
});

describe("Calaerion (11193)", () => {
  it("11193:A:1 11193:B:1 is removed from the game when he leaves play, on either side", () => {
    for (const face of ["up", "B"] as const) {
      const made = make({});
      const spawned = spawn(made.state, CODES.calaerion, { zone: "play", seat: 0 }, face);
      const state = settle(moveCard(syncConstants(spawned.state, made.ctx), spawned.id, { zone: "discard", seat: 0 }), made.ctx, []);
      expect(state.cards[spawned.id]?.zone, face).toBe("removed");
    }
  });
});
