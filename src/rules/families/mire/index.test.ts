// Rules: mec112.mire (data/rules/entries.json); ledger lines 144019:A:1, 144020:A:2, 144016:A:2, 144024:A:2. The Mire keyword on a table of The Passage of the Marshes: the flag, the token, the discard at X, the Forced effect that hears it, the end of the refresh phase.
import { beforeAll, describe, expect, it } from "vitest";

import type { EngineStep } from "../../core/intents.ts";
import { settle } from "../../engine/machine.ts";
import { resolveRecords } from "../../../../test/harness/scene-kit.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { syncConstants } from "../../interpret/constants.ts";
import { crossBoundary } from "../../windows/triggers.ts";
import { holds } from "../../interpret/conditions.ts";
import type { ScenarioState } from "../../core/state.ts";
import { moveCard, spawn } from "../../core/zones.ts";
import { probeTable } from "../../../../scripts/card-smoke/encounter.ts";
import { encounterWorld, type EncounterWorld } from "../../../../scripts/card-smoke/encounter-world.ts";
import { mireAtRefreshEnd, mireOf, mireTally } from "./index.ts";

let world: EncounterWorld;
let table: ScenarioState;
const ctxOf = () => world.contexts.strong;

beforeAll(async () => {
  world = await encounterWorld("the-passage-of-the-marshes");
  table = probeTable(world);
});

/** A location of the code in the staging area (or active), its constants brought up to date. */
function placed(code: string, zone: "staging" | "activeLocation" = "staging"): { state: ScenarioState; id: string } {
  const spawned = spawn(table, code, { zone });
  return { state: syncConstants(spawned.state, ctxOf()), id: spawned.id };
}

const put = (state: ScenarioState, id: string, amount: number, steps: EngineStep[] = []) => runInstruction(state, { verb: "PlaceMireToken", on: "self", amount }, { seat: 0, sourceId: id }, ctxOf(), steps);
const quiet = (state: ScenarioState): ScenarioState => settle({ ...state, window: null, mode: "stopped" }, ctxOf(), []);

describe("Mire X (144019:A:1)", () => {
  it("is the flag a location's constant record sets to its X", () => {
    const fens = placed("144019");
    expect(mireOf(fens.state, fens.id)).toBe(3);
    expect(mireTally(fens.state, fens.id)).toEqual({ value: 3, tokens: 0 });
    const mere = placed("144021");
    expect(mireOf(mere.state, mere.id)).toBe(2);
  });

  it("discards the location to the encounter discard pile when its tokens reach X, never to the victory display", () => {
    const { state, id } = placed("144019");
    const two = put(state, id, 2);
    expect(two.cards[id]?.zone).toBe("staging");
    expect(two.cards[id]?.resources).toBe(2);
    const three = put(two, id, 1);
    expect(three.cards[id]?.zone).toBe("encounterDiscard");
    expect(three.victory).not.toContain(id);
    expect(three.cards[id]?.resources).toBe(0);
    expect(three.pendingEvents?.some((event) => event.trigger === "discardedByMire" && event.subject === id)).toBe(true);
  });

  it("counts the tokens placed past X as reaching it", () => {
    const { state, id } = placed("144020");
    expect(put(state, id, 4).cards[id]?.zone).toBe("encounterDiscard");
  });

  it("lets a location without the keyword keep its tokens, which do nothing", () => {
    const ring = spawn(table, "144053", { zone: "staging" });
    const kept = put(syncConstants(ring.state, ctxOf()), ring.id, 3);
    expect(kept.cards[ring.id]?.zone).toBe("staging");
    const plain = placed("144022");
    expect(mireOf(plain.state, plain.id)).toBe(5);
  });

  it("discards the active location the same way (144016:A:2)", () => {
    const { state, id } = placed("144021", "activeLocation");
    expect(state.activeLocation).toBe(id);
    const mired = put(state, id, 2);
    expect(mired.cards[id]?.zone).toBe("encounterDiscard");
    expect(mired.activeLocation).toBeNull();
  });
});

describe("the Forced effect of a location discarded by Mire", () => {
  it("fires as it is discarded: Evil-smelling Fens deals 1 damage to each character (144019:A:1)", () => {
    const { state, id } = placed("144019");
    const hero = state.seats[0]?.heroes[0] ?? "";
    const before = state.cards[hero]?.damage ?? 0;
    const settled = quiet(put(state, id, 3));
    expect(settled.cards[hero]?.damage).toBe(before + 1);
  });

  it("is not heard when the location is discarded another way", () => {
    const { state, id } = placed("144019");
    const hero = state.seats[0]?.heroes[0] ?? "";
    const moved = runInstruction(state, { verb: "MoveEncounterCard", card: "self", to: "discard" }, { seat: 0, sourceId: id }, ctxOf(), []);
    expect(quiet(moved).cards[hero]?.damage).toBe(state.cards[hero]?.damage);
  });

  it("raises each player's threat by 5 when Stagnant Pools goes (144022:A:1)", () => {
    const { state, id } = placed("144022");
    const threat = state.seats[0]?.threat ?? 0;
    expect(quiet(put(state, id, 5)).seats[0]?.threat).toBe(threat + 5);
  });
});

describe("the end of the refresh phase (144024:A:2)", () => {
  it("places 1 mire token on each Mire location in the staging area, and discards the one that reaches X", () => {
    const fens = placed("144019");
    const mere = spawn(fens.state, "144021", { zone: "staging" });
    let state = syncConstants(put(mere.state, mere.id, 1), ctxOf());
    state = mireAtRefreshEnd(state, ctxOf(), []);
    expect(state.cards[fens.id]?.resources).toBe(1);
    expect(state.cards[mere.id]?.zone).toBe("encounterDiscard");
  });

  it("runs where the refresh phase ends (crossBoundary), once, and not at any other boundary", () => {
    const { state, id } = placed("144019");
    const ended = crossBoundary({ ...state, boundaryPhase: "Refresh", phase: "End of round" }, ctxOf(), []);
    expect(ended.cards[id]?.resources).toBe(1);
    const other = crossBoundary({ ...state, boundaryPhase: "Combat", phase: "Refresh" }, ctxOf(), []);
    expect(other.cards[id]?.resources).toBe(0);
  });

  it("144024:A:2 Creeping Marshes attaches to the quest, then puts a token on each staging location after the keyword's own and is discarded", () => {
    // The dealt table's own staging area (a Mire 1 location that would go at once) is cleared away first.
    const bare = table.staging.reduce((state, id) => moveCard(state, id, { zone: "encounterDiscard" }), table);
    const fens = spawn(bare, "144019", { zone: "staging" });
    const id = fens.id;
    const state = syncConstants(fens.state, ctxOf());
    const plain = spawn(state, "144053", { zone: "staging" });
    const revealed = resolveRecords(plain.state, ctxOf(), "144024", "whenRevealed", undefined, undefined, false);
    const marshes = revealed.id;
    expect(revealed.state.cards[marshes]?.host).toBe(revealed.state.questStage);
    const crossed = crossBoundary({ ...revealed.state, boundaryPhase: "Refresh", phase: "End of round", window: null }, ctxOf(), []);
    const settled = settle({ ...crossed, window: null, mode: "stopped" }, ctxOf(), []);
    // The keyword's token and Creeping Marshes' own: 2 on the Fens (Mire 3); an enemy in the staging area is no location and gets none.
    expect(settled.cards[id]?.resources).toBe(2);
    expect(settled.cards[plain.id]?.resources).toBe(0);
    expect(settled.cards[marshes]?.zone).toBe("encounterDiscard");
  });

  it("does not place a token on the active location", () => {
    const { state, id } = placed("144019", "activeLocation");
    expect(mireAtRefreshEnd(state, ctxOf(), []).cards[id]?.resources).toBe(0);
  });

  it("is read by Stagnant Pools' Threat (144022:A:2)", () => {
    const { state, id } = placed("144022");
    const two = syncConstants(put(state, id, 2), ctxOf());
    expect(two.cards[id]?.resources).toBe(2);
    expect(holds(two, { kind: "tokens", code: "144022", min: 2 }, { actor: 0, sourceId: id, returned: 0 }, ctxOf())).toBe(true);
  });
});

describe("ReturnRandomVictoryLocation (144020:A:2)", () => {
  it("returns one location of the victory display to the staging area, with the game's seed", () => {
    const one = placed("144021");
    const two = spawn(one.state, "144023", { zone: "victory" });
    const three = spawn(two.state, "144022", { zone: "victory" });
    const back = runInstruction(three.state, { verb: "ReturnRandomVictoryLocation" }, { seat: 0, sourceId: null }, ctxOf(), []);
    expect(back.victory).toHaveLength(1);
    expect(back.staging.filter((id) => [two.id, three.id].includes(id))).toHaveLength(1);
    expect(back.staging).toContain(one.id);
  });

  it("does nothing with an empty victory display", () => {
    expect(runInstruction(table, { verb: "ReturnRandomVictoryLocation" }, { seat: 0, sourceId: null }, ctxOf(), [])).toBe(table);
  });
});
