// Rules: emce.side-quests, emce.side-quests-in-play, rr.damage, rr.threat-threat-dial (data/rules/entries.json); ledger lines 19070:A:1, 19070:A:2, 19080:A:2.
// Two of the user's rulings on Fire in the Night (docs/brief.md, Ered Mithrin): Powerful in Wrath reads the active location's Threat before it is discarded and gains surge when there is no active location or its Threat is 0, and Hold the Door
// bars every threat reduction, whatever its source.
import { beforeAll, describe, expect, it } from "vitest";

import { modifiedStat } from "../../../rules/core/keywords.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { CODES, codesIn, finish, idOf, loadNightWorld, nightTable, resolveRecords, send, start, type NightWorld } from "../../../../test/scenarios/fire-in-the-night/scene.ts";

let world: NightWorld;
beforeAll(async () => {
  world = await loadNightWorld();
}, 120_000);

const hill = (state: ScenarioState) => state.cards[state.questStage ?? ""]!;

describe("Powerful in Wrath reads the Threat of the active location before it is discarded (19080:A:2)", () => {
  it("19080:A:2 the active location's Threat is read before it is discarded: a location whose Threat is 0 deals no damage, and Powerful in Wrath gains surge", () => {
    const base = nightTable(world, { staging: [CODES.dagnir], deck: [CODES.powerfulInWrath, "f3", "f0"], active: CODES.townGate });
    const gate = idOf(base.state, CODES.townGate);
    // Town Gate's Threat of 3 is lowered to 0 until the end of the phase.
    const state = { ...base.state, modifiers: [...base.state.modifiers, { instanceId: gate, sourceId: gate, stat: "threat" as const, amount: -3, until: "endOfPhase" as const }] };
    expect(modifiedStat(state, state.cards[gate]!, "threat", world.cards)).toBe(0);
    let phased = send(start(state), { type: "Commit", cardIds: [base.hero2] }, base.ctx);
    phased = finish(send(phased, { type: "Pass" }, base.ctx), base.ctx);
    expect(phased.state.cards[gate]?.zone).toBe("encounterDiscard");
    expect(hill(phased.state).damage).toBe(0);
    expect(codesIn(phased.state, "staging")).toContain("f3");
  });
});

describe("Hold the Door bars every threat reduction (19070:A:1)", () => {
  it("19070:A:1 every threat reduction is barred, not one verb's: an effect that lowers a player's threat while it is in the staging area changes nothing, and the Response of the card itself is the same once it is defeated", () => {
    const t = nightTable(world, { seats: 2, staging: [CODES.dagnir, CODES.holdTheDoor], threat: [35, 28] });
    // The Response's own LowerThreat verb, run while the card is still in the staging area: nothing is reduced.
    const barred = resolveRecords(t.state, t.ctx, CODES.holdTheDoor, "response", idOf(t.state, CODES.holdTheDoor));
    expect(barred.state.seats.map((seat) => seat.threat)).toEqual([35, 28]);
    const gone = nightTable(world, { seats: 2, staging: [CODES.dagnir], victory: [CODES.holdTheDoor], threat: [35, 28] });
    expect(resolveRecords(gone.state, gone.ctx, CODES.holdTheDoor, "response", idOf(gone.state, CODES.holdTheDoor)).state.seats.map((seat) => seat.threat)).toEqual([30, 23]);
  });
});
